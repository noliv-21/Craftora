const Orders = require('../models/orderSchema');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

const dashboard = async (req, res) => {
    try {
        // Get overall statistics
        const orders = await Orders.find().populate('userId').populate('products.productId');
        
        const totalRevenue = orders.reduce((sum, order) => sum + order.totalAmount, 0);
        const totalSales = orders.length;
        const totalDiscount = orders.reduce((sum, order) => sum + (order.totalDiscountAmount || 0), 0);

        // Get default sales report (last 7 days)
        const last7Days = new Date();
        last7Days.setDate(last7Days.getDate() - 7);
        
        const salesReport = await Orders.find({
            createdAt: { $gte: last7Days }
        })
        .populate('userId')
        .populate('products.productId')
        .sort({ createdAt: -1 });

        const reportData = salesReport.map(order => ({
            orderId: order.orderId  || order._id,
            date: order.createdAt.toLocaleDateString(),
            customerName: order.userId.fullname || order.userId.username,
            products: order.products.map(item => item.productId.name),
            amount: order.products.reduce((sum,prod) => sum + (prod.productId.mrp * prod.quantity), 0),
            discount: order.totalDiscountAmount || 0,    // This is the correct code don't delete
            finalAmount: order.totalAmount
        }));

        const totalAmount = reportData.reduce((sum, order) => sum + order.amount, 0);
        const totalDiscountAmount = reportData.reduce((sum, order) => sum + order.discount, 0);
        const totalFinalAmount = reportData.reduce((sum, order) => sum + order.finalAmount, 0);

        const productAggregation = await Orders.aggregate([
            { $match: { status: { $ne: 'Cancelled' } } },
            { $unwind: '$products' },
            { $lookup: {
                from: 'products',
                localField: 'products.productId',
                foreignField: '_id',
                as: 'productDetails'
            }},
            { $unwind: '$productDetails'},
            { $group: {
                _id: '$products.productId',
                totalSold: { $sum: '$products.quantity' },
                name: { $first: '$productDetails.name' }
            }},
            { $sort: { totalSold: -1 } },
            { $limit: 10 },
            { $project: {
                _id: 1,
                totalSold: 1,
                name: 1 // Project the name field
            }}
        ]);

        // Aggregate to find top-selling categories
        const categoryAggregation = await Orders.aggregate([
            { $match: { status: { $ne: 'Cancelled' } } },
            { $unwind: '$products' },
            { $lookup: {
                from: 'products',
                localField: 'products.productId',
                foreignField: '_id',
                as: 'productDetails'
            }},
            { $unwind: '$productDetails' },
            { $group: {
                _id: '$productDetails.category',
                totalSold: { $sum: '$products.quantity' }
            }},
            { $lookup: {
                from: 'categories',
                localField: '_id',
                foreignField: '_id',
                as: 'categoryDetails'
            }},
            { $unwind: '$categoryDetails' },
            { $project: {
                _id: 1,
                totalSold: 1,
                name: '$categoryDetails.name'
            }},
            { $sort: { totalSold: -1 } },
            { $limit: 10 }
        ]);

        res.render('admin/dashboard', {
            activeTab: "dashboard",
            totalRevenue,
            totalSales,
            totalDiscount,
            salesReport: reportData,
            totalAmount,
            totalDiscountAmount,
            totalFinalAmount,
            topProducts: productAggregation,
            topCategories: categoryAggregation
        });
    } catch (error) {
        console.error('Dashboard Error:', error);
        res.status(500).send('Server error');
    }
};

const generateSalesReport = async (req, res) => {
    try {
        const { type, date, startDate, endDate } = req.query;
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        let dateFilter = {};

        // Set up date filter based on report type
        switch(type) {
            case 'today':
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                dateFilter = { createdAt: { $gte: today } };
                break;

            case 'yesterday':
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                yesterday.setHours(0, 0, 0, 0);
                const yesterdayEnd = new Date(yesterday);
                yesterdayEnd.setHours(23, 59, 59, 999);
                dateFilter = { createdAt: { $gte: yesterday, $lte: yesterdayEnd } };
                break;

            case 'thisWeek':
                const thisWeek = new Date();
                thisWeek.setDate(thisWeek.getDate() - thisWeek.getDay());
                thisWeek.setHours(0, 0, 0, 0);
                dateFilter = { createdAt: { $gte: thisWeek } };
                break;

            case 'thisMonth':
                const thisMonth = new Date();
                thisMonth.setDate(1);
                thisMonth.setHours(0, 0, 0, 0);
                dateFilter = { createdAt: { $gte: thisMonth } };
                break;

            case 'specificDate':
                const specificDate = new Date(date);
                const nextDate = new Date(specificDate);
                nextDate.setDate(nextDate.getDate() + 1);
                dateFilter = { createdAt: { $gte: specificDate, $lt: nextDate } };
                break;

            case 'customRange':
                const startDateTime = new Date(startDate);
                const endDateTime = new Date(endDate);
                endDateTime.setHours(23, 59, 59, 999);
                dateFilter = { createdAt: { $gte: startDateTime, $lte: endDateTime } };
                break;

            default: // 'all'
                dateFilter = {};
        }

        const totalOrders = await Orders.countDocuments(dateFilter);
        const totalPages = Math.ceil(totalOrders / limit);
        // Get filtered orders
        const orders = await Orders.find(dateFilter)
            .populate('userId')
            .populate('products.productId')
            .sort({ createdAt: -1 }).skip(skip).limit(limit);

        const reportData = orders.map(order => ({
            orderId: order.orderId || order._id,
            date: order.createdAt.toLocaleDateString(),
            customerName: order.userId.fullname || order.userId.username,
            products: order.products.map(item => item.productId.name),
            amount: order.products.reduce((sum,prod) => sum + (prod.priceAtPurchase * prod.quantity), 0),
            discount: order.totalDiscountAmount || 0,
            finalAmount: order.totalAmount
        }));

        const totalAmount = reportData.reduce((sum, order) => sum + order.amount, 0);
        const totalDiscountAmount = reportData.reduce((sum, order) => sum + order.discount, 0);
        const totalFinalAmount = reportData.reduce((sum, order) => sum + order.finalAmount, 0);

        // Send JSON response for AJAX request
        res.json({
            salesReport: reportData,
            pagination: {
                currentPage: page,
                totalPages,
                totalOrders,
                limit
            }
        });
    } catch (error) {
        console.error('Generate Sales Report Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

async function getFilteredOrders(type, date, startDate, endDate) {
    let dateFilter = {};

    switch(type) {
        case 'today':
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            dateFilter = { createdAt: { $gte: today } };
            break;
        case 'yesterday':
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            yesterday.setHours(0, 0, 0, 0);
            const yesterdayEnd = new Date(yesterday);
            yesterdayEnd.setHours(23, 59, 59, 999);
            dateFilter = { createdAt: { $gte: yesterday, $lte: yesterdayEnd } };
            break;
        case 'thisWeek':
            const weekStart = new Date();
            weekStart.setDate(weekStart.getDate() - weekStart.getDay());
            weekStart.setHours(0, 0, 0, 0);
            dateFilter = { createdAt: { $gte: weekStart } };
            break;
        case 'thisMonth':
            const monthStart = new Date();
            monthStart.setDate(1);
            monthStart.setHours(0, 0, 0, 0);
            dateFilter = { createdAt: { $gte: monthStart } };
            break;
        case 'specificDate':
            const specificDate = new Date(date);
            const nextDate = new Date(date);
            nextDate.setDate(nextDate.getDate() + 1);
            dateFilter = { createdAt: { $gte: specificDate, $lt: nextDate } };
            break;
        case 'customRange':
            const startDateTime = new Date(startDate);
            const endDateTime = new Date(endDate);
            endDateTime.setHours(23, 59, 59, 999);
            dateFilter = { createdAt: { $gte: startDateTime, $lte: endDateTime } };
            break;
        default:
            break;
    }

    const orders = await Orders.find(dateFilter)
        .populate('userId')
        .populate('products.productId')
        .sort({ createdAt: -1 });

    return orders;
}

const downloadSalesReport = async (req, res) => {
    try {
        const { type, date, startDate, endDate, format } = req.query;

        const orders = await getFilteredOrders(type, date, startDate, endDate);

        const reportData = orders.map(order => ({
            orderId: order.orderId || order._id,
            date: order.createdAt.toLocaleDateString(),
            customerName: order.userId ? (order.userId.fullname || order.userId.username) : 'Unknown',
            products: order.products.map(item => item.productId ? item.productId.name : 'Unknown Product'),
            amount: order.products.reduce((sum, prod) => sum + ((prod.productId ? prod.productId.mrp : 0) * prod.quantity), 0),
            discount: order.totalDiscountAmount || 0,
            finalAmount: order.totalAmount
        }));

        if (format === 'pdf') {
            const doc = new PDFDocument({
                margin: 30,
                size: 'A4'
            });
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=sales-report-${Date.now()}.pdf`);
            doc.pipe(res);

            // Add header with modern styling
            doc.rect(0, 0, doc.page.width, 120)
               .fill('#2196f3'); // Changed to a lighter blue

            // Add a subtle accent line
            doc.rect(0, 120, doc.page.width, 3)
               .fill('#1976d2');

            // Add header text with shadow effect
            doc.fontSize(32)
               .font('Helvetica-Bold')
               .fillColor('#ffffff')
               .text('Sales Report', 50, 45, { align: 'center' });

            // Add date range info
            let dateRangeText = 'All Time';
            if (date) {
                dateRangeText = new Date(date).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                });
            } else if (startDate && endDate) {
                dateRangeText = `${new Date(startDate).toLocaleDateString('en-US', { 
                    month: 'long', 
                    day: 'numeric' 
                })} - ${new Date(endDate).toLocaleDateString('en-US', { 
                    month: 'long', 
                    day: 'numeric',
                    year: 'numeric'
                })}`;
            }

            doc.fontSize(14)
               .font('Helvetica')
               .text(`Period: ${dateRangeText}`, 50, 85, { align: 'center' });

            // Add metadata section with better visibility
            doc.fontSize(10)
               .fillColor('#ffffff')  // Changed from #e8eaf6 to white for better visibility
               .text(`Generated on: ${new Date().toLocaleString()}`, 50, 140, { align: 'right' })
               .text(`Total Orders: ${reportData.length}`, 50, 155, { align: 'right' });

            // Define table layout with modern styling and adjusted spacing
            const tableTop = 190;
            const pageWidth = doc.page.width;
            const rightMargin = 50;  // Increased right margin
            const columnSpacing = {
                srNo: 35,      // Serial number
                orderId: 85,   // Order ID position
                date: 230,     // Date position
                customer: 310,  // Customer position
                amount: 380,   // Adjusted Amount position
                discount: 445, // Adjusted Discount position
                final: 500     // Adjusted Final amount position to ensure right margin
            };

            // Add table headers with modern styling
            doc.fontSize(10)
               .font('Helvetica-Bold');
            
            // Draw header background with rounded corners
            doc.roundedRect(30, tableTop - 5, pageWidth - 80, 25, 3)  // Increased width to match table
               .fill('#f3f4f6');
            
            // Draw headers with modern styling
            doc.fillColor('#1976d2')
               .text('Sr.', columnSpacing.srNo, tableTop, { width: 30, align: 'center' })
               .text('Order ID', columnSpacing.orderId, tableTop, { width: 130 })
               .text('Date', columnSpacing.date, tableTop, { width: 70 })
               .text('Customer', columnSpacing.customer, tableTop, { width: 60 })
               .text('Amount', columnSpacing.amount, tableTop, { width: 55, align: 'right' })
               .text('Discount', columnSpacing.discount, tableTop, { width: 55, align: 'right' })
               .text('Final', columnSpacing.final, tableTop, { width: 55, align: 'right' });

            // Draw a subtle line under headers
            doc.moveTo(30, tableTop + 20)
               .lineTo(pageWidth - 50, tableTop + 20)
               .strokeColor('#e0e0e0')
               .stroke();

            let position = tableTop + 30;
            doc.font('Helvetica');

            reportData.forEach((sale, index) => {
                if (position > 750) {  // Adjusted page break threshold
                    doc.addPage();
                    // Add header to new page with gradient
                    doc.rect(0, 0, doc.page.width, 50)
                       .fill('#1a237e');
                    doc.rect(0, 50, doc.page.width, 2)
                       .fill('#4527a0');
                    
                    doc.fontSize(16)
                       .font('Helvetica-Bold')
                       .fillColor('#ffffff')
                       .text('Sales Report (Continued)', 50, 20, { align: 'center' });
                    
                    // Reset position and redraw column headers
                    position = 70;
                    doc.fontSize(10)
                       .font('Helvetica-Bold')
                       .fillColor('#1a237e');
                    
                    // Redraw headers on new page with matching background width
                    doc.roundedRect(30, position - 5, pageWidth - 80, 25, 3)
                       .fill('#f3f4f6');
                    
                    doc.fillColor('#1a237e')
                       .text('Sr.', columnSpacing.srNo, position, { width: 30, align: 'center' })
                       .text('Order ID', columnSpacing.orderId, position, { width: 130 })
                       .text('Date', columnSpacing.date, position, { width: 70 })
                       .text('Customer', columnSpacing.customer, position, { width: 60 })
                       .text('Amount', columnSpacing.amount, position, { width: 55, align: 'right' })
                       .text('Discount', columnSpacing.discount, position, { width: 55, align: 'right' })
                       .text('Final', columnSpacing.final, position, { width: 55, align: 'right' });
                    
                    position += 30;
                }

                // Alternate row background with rounded corners
                if (index % 2 === 0) {
                    doc.roundedRect(30, position - 5, pageWidth - (rightMargin + 30), 22, 2)
                       .fill('#f8f9fa');
                }

                doc.fillColor('#333333')
                   .fontSize(9)  // Slightly smaller font for data
                   .text(index + 1, columnSpacing.srNo, position)
                   .text(sale.orderId.toString(), columnSpacing.orderId, position, { width: 130 })
                   .text(sale.date, columnSpacing.date, position)
                   .text(sale.customerName.slice(0, 20), columnSpacing.customer, position)
                   .text(`₹${sale.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, columnSpacing.amount, position, { width: 55, align: 'right' })
                   .text(`₹${sale.discount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, columnSpacing.discount, position, { width: 55, align: 'right' })
                   .text(`₹${sale.finalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, columnSpacing.final, position, { width: 55, align: 'right' });

                position += 22;
            });

            // Add summary section with proper spacing
            const summaryTop = Math.min(position + 30, 750);
            
            // Draw summary container with gradient and rounded corners
            doc.roundedRect(30, summaryTop, pageWidth - (rightMargin + 30), 100, 5)
               .fill('#f8f9fa');
            
            // Add subtle border
            doc.roundedRect(30, summaryTop, pageWidth - (rightMargin + 30), 100, 5)
               .strokeColor('#e0e0e0')
               .stroke();

            const totalAmount = reportData.reduce((sum, sale) => sum + sale.amount, 0);
            const totalDiscount = reportData.reduce((sum, sale) => sum + sale.discount, 0);
            const totalFinal = reportData.reduce((sum, sale) => sum + sale.finalAmount, 0);

            // Add summary content with modern styling
            doc.font('Helvetica-Bold')
               .fontSize(16)
               .fillColor('#1976d2')
               .text('Summary', 50, summaryTop + 15);

            // Add summary details with grid layout and improved typography
            const summaryLeftCol = 50;
            const summaryValueCol = 150;
            const summaryRightCol = 280;
            const summaryRightValueCol = 380;

            doc.fontSize(11)
               .font('Helvetica-Bold')
               .fillColor('#333333')
               .text('Total Orders:', summaryLeftCol, summaryTop + 45)
               .text(`${reportData.length}`, summaryValueCol, summaryTop + 45)
               .text('Total Amount:', summaryRightCol, summaryTop + 45)
               .text(`₹${totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, summaryRightValueCol, summaryTop + 45);

            doc.text('Total Discount:', summaryLeftCol, summaryTop + 65)
               .text(`₹${totalDiscount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, summaryValueCol, summaryTop + 65)
               .text('Final Revenue:', summaryRightCol, summaryTop + 65)
               .fillColor('#1976d2')
               .text(`₹${totalFinal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, summaryRightValueCol, summaryTop + 65);

            doc.end();

        } else if (format === 'excel') {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Sales Report');

            let dateRangeText = 'All Time';
            if (date) {
                dateRangeText = new Date(date).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                });
            } else if (startDate && endDate) {
                dateRangeText = `${new Date(startDate).toLocaleDateString('en-US', { 
                    month: 'long', 
                    day: 'numeric' 
                })} - ${new Date(endDate).toLocaleDateString('en-US', { 
                    month: 'long', 
                    day: 'numeric',
                    year: 'numeric'
                })}`;
            }

            worksheet.columns = [
                { header: 'Sr. No.', key: 'srNo', width: 8 },
                { header: 'Order ID', key: 'orderId', width: 30 }, // Increased width
                { header: 'Date', key: 'date', width: 15 },
                { header: 'Customer Name', key: 'customerName', width: 30 },
                { header: 'Products', key: 'products', width: 40 },
                { header: 'Amount', key: 'amount', width: 15 },
                { header: 'Discount', key: 'discount', width: 15 },
                { header: 'Final Amount', key: 'finalAmount', width: 15 }
            ];

            worksheet.spliceRows(1, 0, ['Sales Report']);
            worksheet.spliceRows(2, 0, [`Period: ${dateRangeText}`]);
            worksheet.spliceRows(3, 0, [`Generated on: ${new Date().toLocaleString()}`]);
            worksheet.spliceRows(4, 0, []); // Empty row for spacing

            // Enhanced Excel styling
            worksheet.getRow(1).font = { bold: true, size: 16, color: { argb: 'FF1A237E' } };
            worksheet.getRow(1).height = 30;
            worksheet.getRow(2).font = { size: 12, color: { argb: 'FF333333' } };
            worksheet.getRow(3).font = { size: 10, color: { argb: 'FF666666' } };

            // Style the header row
            const headerRow = worksheet.getRow(5);
            headerRow.font = { bold: true, color: { argb: 'FFFFFF' }, size: 11 };
            headerRow.height = 25;
            headerRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: '2196F3' }  // Updated to lighter blue
            };

            // Improve cell borders and alignment
            headerRow.eachCell((cell) => {
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
                    bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } }
                };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
            });

            reportData.forEach((sale, idx) => {
                const row = worksheet.addRow({
                    srNo: idx + 1,
                    orderId: sale.orderId,
                    date: sale.date,
                    customerName: sale.customerName,
                    products: sale.products.join(', '),
                    amount: sale.amount,
                    discount: sale.discount,
                    finalAmount: sale.finalAmount
                });

                if (idx % 2 === 0) {
                    row.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFF8F9FA' }
                    };
                }

                // Center align the serial number
                row.getCell('srNo').alignment = { horizontal: 'center' };
            });

            ['amount', 'discount', 'finalAmount'].forEach(col => {
                worksheet.getColumn(col).numFmt = '₹#,##0.00';
                worksheet.getColumn(col).alignment = { horizontal: 'right' };
            });

            worksheet.addRow([]); // Empty row
            const summaryStartRow = worksheet.rowCount + 1;

            worksheet.addRow(['Summary']);
            worksheet.getRow(summaryStartRow).font = { bold: true, size: 12 };

            worksheet.addRow(['Total Orders:', reportData.length]);
            worksheet.addRow(['Total Amount:', `=SUM(E6:E${reportData.length + 5})`]);
            worksheet.addRow(['Total Discount:', `=SUM(F6:F${reportData.length + 5})`]);
            worksheet.addRow(['Final Revenue:', `=SUM(G6:G${reportData.length + 5})`]);

            for (let i = summaryStartRow + 1; i <= summaryStartRow + 4; i++) {
                const row = worksheet.getRow(i);
                row.getCell(2).numFmt = '₹#,##0.00';
            }

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=sales-report-${Date.now()}.xlsx`);

            await workbook.xlsx.write(res);
            res.end();
        }
    } catch (error) {
        console.error('Download Report Error:', error);
        res.status(500).send('Error generating report');
    }
};

const getAnalyticsData = async (req,res)=>{
    const period = req.params.period;
    const { startDate: customStartDate, endDate: customEndDate } = req.query;
    try {
        let dateFormat, groupBy;
        const now = new Date();
        let startDate;

        if (customStartDate && customEndDate) {
            // Custom range
            startDate = new Date(customStartDate);
            groupBy = { 
                year: { $year: '$createdAt' },
                month: { $month: '$createdAt' },
                day: { $dayOfMonth: '$createdAt' }
            };
        } else {
            switch (period) {
                case 'weekly':
                    // Last 7 weeks
                    dateFormat = '%Y-W%V'; // Year-Week format
                    groupBy = { $week: '$createdAt' };
                    startDate = new Date(now.setDate(now.getDate() - 49)); // 7 weeks ago
                    break;
                case 'monthly':
                    // Last 6 months
                    dateFormat = '%Y-%m'; // Year-Month format
                    groupBy = { $month: '$createdAt' };
                    startDate = new Date(now.setMonth(now.getMonth() - 6));
                    break;
                case 'yearly':
                    // Shows all years
                    dateFormat = '%Y'; // Year format
                    groupBy = { $year: '$createdAt' };
                    startDate = new Date(2000, 0, 1);
                    break;
                default:
                    return res.status(400).json({ error: 'Invalid period' });
            }
        }

        const matchStage = {
            status: { $ne: 'Cancelled' }
        };

        // Add date filters
        if (customStartDate && customEndDate) {
            matchStage.createdAt = { 
                $gte: new Date(customStartDate), 
                $lte: new Date(customEndDate)
            };
        } else {
            matchStage.createdAt = { $gte: startDate };
        }

        const analytics = await Orders.aggregate([
            {
                $match: matchStage
            },
            {
                $group: {
                    _id: customStartDate && customEndDate
                        ? groupBy
                        : period === 'yearly'
                            ? { year: { $year: '$createdAt' } }
                            : {
                                date: groupBy,
                                year: { $year: '$createdAt' },
                                month: { $month: '$createdAt' }
                            },
                    orders: { $sum: 1 },
                    revenue: { $sum: '$totalAmount' }
                }
            },
            {
                $sort: customStartDate && customEndDate
                    ? { 
                        '_id.year': 1,
                        '_id.month': 1,
                        '_id.day': 1
                    }
                    : period === 'yearly'
                        ? { '_id.year': 1 }
                        : {
                            '_id.year': 1,
                            '_id.month': 1,
                            '_id.date': 1
                        }
            }
        ]);

        // Format the response
        let labels = [];
        let orders = [];
        let revenue = [];

        if (customStartDate && customEndDate) {
            // Generate all dates in range
            const start = new Date(customStartDate);
            const end = new Date(customEndDate);
            const dateMap = new Map();

            // Create map of existing data
            analytics.forEach(item => {
                const dateStr = `${String(item._id.day).padStart(2, '0')}-${String(item._id.month).padStart(2, '0')}-${item._id.year}`;
                dateMap.set(dateStr, {
                    orders: item.orders,
                    revenue: item.revenue
                });
            });

            // Fill in all dates including those with no orders
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                const dateStr = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
                const data = dateMap.get(dateStr) || { orders: 0, revenue: 0 };
                
                labels.push(dateStr);
                orders.push(data.orders);
                revenue.push(data.revenue);
            }
        } else {
            // Format labels based on period
            analytics.forEach(item => {
                let label;
                if (customStartDate && customEndDate) {
                    // Format as YYYY-MM-DD for custom range
                    label = `${String(item._id.day).padStart(2, '0')}-${String(item._id.month).padStart(2, '0')}-${item._id.year}`;
                } else {
                    switch (period) {
                        case 'weekly':
                            label = `Week ${item._id.date}`;
                            break;
                        case 'monthly':
                            label = new Date(0, item._id.month - 1).toLocaleString('default', { month: 'short' });
                            break;
                        case 'yearly':
                            label = item._id.year.toString();
                            break;
                    }
                }
                
                labels.push(label);
                orders.push(item.orders);
                revenue.push(item.revenue);
            });
        }

        res.json({
            labels,
            orders,
            revenue
        });
    } catch (error) {
        console.error(error);
        res.status(500).json("Error getting analytics data");
    }
}

module.exports = {
    dashboard,
    generateSalesReport,
    downloadSalesReport,
    getAnalyticsData
}