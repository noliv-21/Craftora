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

        res.render('admin/dashboard', {
            activeTab: "dashboard",
            totalRevenue,
            totalSales,
            totalDiscount,
            salesReport: reportData,
            totalAmount,
            totalDiscountAmount,
            totalFinalAmount
        });
    } catch (error) {
        console.error('Dashboard Error:', error);
        res.status(500).send('Server error');
    }
};

const generateSalesReport = async (req, res) => {
    try {
        const { type, date, startDate, endDate } = req.query;
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

        // Get filtered orders
        const orders = await Orders.find(dateFilter)
            .populate('userId')
            .populate('products.productId')
            .sort({ createdAt: -1 });

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
            salesReport: reportData
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
        // const mockReq = { query: req.query };
        // const reportData = await generateSalesReport(mockReq, null, true);
        // const { format } = req.query;

        const { type, date, startDate, endDate, format } = req.query;
        
        // Get the filtered orders first
        const orders = await getFilteredOrders(type, date, startDate, endDate);
        
        // Transform orders into report data
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
                margin: 50,
                size: 'A4'
            });
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=sales-report-${Date.now()}.pdf`);
            doc.pipe(res);

            // Add header with logo or company name
            doc.fontSize(24)
               .font('Helvetica-Bold')
               .text('Sales Report', { align: 'center' });
            doc.moveDown();

            // Add date range info
            doc.fontSize(12)
               .font('Helvetica')
               .text(`Generated on: ${new Date().toLocaleDateString()}`, { align: 'right' });
            doc.moveDown();

            // Define table layout
            const tableTop = 150;
            const columnSpacing = {
                orderId: 50,
                date: 150,
                customer: 250,
                amount: 350,
                discount: 450,
                final: 550
            };

            // Add table headers with background
            doc.fontSize(10)
               .font('Helvetica-Bold');
            
            // Draw header background
            doc.rect(40, tableTop - 5, 520, 20)
               .fill('#f3f4f6');
            
            // Draw headers
            doc.fillColor('#000000')
               .text('Order ID', columnSpacing.orderId, tableTop)
               .text('Date', columnSpacing.date, tableTop)
               .text('Customer', columnSpacing.customer, tableTop)
               .text('Amount', columnSpacing.amount, tableTop)
               .text('Discount', columnSpacing.discount, tableTop)
               .text('Final', columnSpacing.final, tableTop);

            // Draw rows
            let position = tableTop + 25;
            doc.font('Helvetica');

            reportData.forEach((sale, index) => {
                // Add new page if needed
                if (position > 700) {
                    doc.addPage();
                    position = 50;
                }

                // Alternate row background for better readability
                if (index % 2 === 0) {
                    doc.rect(40, position - 5, 520, 20)
                       .fill('#f8f9fa');
                }

                doc.fillColor('#000000')
                   .text(sale.orderId.toString().slice(0, 8), columnSpacing.orderId, position)
                   .text(sale.date, columnSpacing.date, position)
                   .text(sale.customerName.slice(0, 15), columnSpacing.customer, position)
                   .text(`₹${sale.amount.toFixed(2)}`, columnSpacing.amount, position)
                   .text(`₹${sale.discount.toFixed(2)}`, columnSpacing.discount, position)
                   .text(`₹${sale.finalAmount.toFixed(2)}`, columnSpacing.final, position);

                position += 20;
            });

            // Add summary section at the bottom
            doc.moveDown(2);
            
            // Draw summary box
            const summaryTop = Math.min(position + 20, 700);
            doc.rect(40, summaryTop, 520, 80)
               .fill('#f3f4f6');
            
            // Calculate totals
            const totalAmount = reportData.reduce((sum, sale) => sum + sale.amount, 0);
            const totalDiscount = reportData.reduce((sum, sale) => sum + sale.discount, 0);
            const totalFinal = reportData.reduce((sum, sale) => sum + sale.finalAmount, 0);

            // Add summary text
            doc.font('Helvetica-Bold')
               .fontSize(12)
               .fillColor('#000000')
               .text('Summary', 60, summaryTop + 10)
               .fontSize(10)
               .text(`Total Orders: ${reportData.length}`, 60, summaryTop + 30)
               .text(`Total Amount: ₹${totalAmount.toFixed(2)}`, 60, summaryTop + 45)
               .text(`Total Discount: ₹${totalDiscount.toFixed(2)}`, 300, summaryTop + 45)
               .text(`Final Revenue: ₹${totalFinal.toFixed(2)}`, 60, summaryTop + 60);

            doc.end();

        } else if (format === 'excel') {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Sales Report');

            // Add headers
            worksheet.columns = [
                { header: 'Order ID', key: 'orderId', width: 15 },
                { header: 'Date', key: 'date', width: 12 },
                { header: 'Customer Name', key: 'customerName', width: 20 },
                { header: 'Products', key: 'products', width: 30 },
                { header: 'Amount', key: 'amount', width: 12 },
                { header: 'Discount', key: 'discount', width: 12 },
                { header: 'Final Amount', key: 'finalAmount', width: 12 }
            ];

            // Style the header row
            worksheet.getRow(1).font = { bold: true };
            worksheet.getRow(1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE0E0E0' }
            };

            // Add data
            reportData.forEach(sale => {
                worksheet.addRow({
                    orderId: sale.orderId,
                    date: sale.date,
                    customerName: sale.customerName,
                    products: sale.products.join(', '),
                    amount: sale.amount,
                    discount: sale.discount,
                    finalAmount: sale.finalAmount
                });
            });

            // Format number columns
            ['amount', 'discount', 'finalAmount'].forEach(col => {
                worksheet.getColumn(col).numFmt = '₹#,##0.00';
            });

            // Add summary at the bottom
            worksheet.addRow([]); // Empty row
            worksheet.addRow(['Total Sales:', reportData.length]);
            worksheet.addRow(['Total Revenue:', reportData.reduce((sum, sale) => sum + sale.finalAmount, 0)]);

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=sales-report-${Date.now()}.xlsx`);

            await workbook.xlsx.write(res);
            res.end();
        } else {
            throw new Error('Invalid format specified');
        }
    } catch (error) {
        console.error('Download Report Error:', error);
        res.status(500).send('Error generating report');
    }
};

module.exports = {
    dashboard,
    generateSalesReport,
    downloadSalesReport
}