const Orders = require('../models/orderSchema');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

exports.dashboard = async (req, res) => {
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

exports.generateSalesReport = async (req, res) => {
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

exports.downloadSalesReport = async (req, res) => {
    try {
        const { format } = req.query;
        const orders = await Orders.find()
            .populate('user')
            .populate('items.product')
            .sort({ createdAt: -1 });

        const reportData = orders.map(order => ({
            orderId: order._id.toString(),
            date: order.createdAt.toLocaleDateString(),
            customerName: order.user.name,
            products: order.items.map(item => item.product.name).join(', '),
            amount: order.totalAmount,
            discount: order.discount || 0,
            finalAmount: order.totalAmount - (order.discount || 0)
        }));

        if (format === 'pdf') {
            const doc = new PDFDocument();
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename=sales-report.pdf');
            doc.pipe(res);

            // Add header
            doc.fontSize(20).text('Sales Report', { align: 'center' });
            doc.moveDown();

            // Add table headers
            const headers = ['Order ID', 'Date', 'Customer', 'Amount', 'Discount', 'Final Amount'];
            let y = doc.y;
            headers.forEach((header, i) => {
                doc.fontSize(12).text(header, 50 + (i * 90), y);
            });

            // Add table rows
            y += 20;
            reportData.forEach(order => {
                const row = [
                    order.orderId.slice(-6),
                    order.date,
                    order.customerName,
                    order.amount.toFixed(2),
                    order.discount.toFixed(2),
                    order.finalAmount.toFixed(2)
                ];
                row.forEach((cell, i) => {
                    doc.fontSize(10).text(cell.toString(), 50 + (i * 90), y);
                });
                y += 20;
                if (y > 700) {
                    doc.addPage();
                    y = 50;
                }
            });

            doc.end();
        } else if (format === 'excel') {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Sales Report');

            worksheet.columns = [
                { header: 'Order ID', key: 'orderId', width: 15 },
                { header: 'Date', key: 'date', width: 15 },
                { header: 'Customer', key: 'customerName', width: 20 },
                { header: 'Products', key: 'products', width: 30 },
                { header: 'Amount', key: 'amount', width: 15 },
                { header: 'Discount', key: 'discount', width: 15 },
                { header: 'Final Amount', key: 'finalAmount', width: 15 }
            ];

            worksheet.addRows(reportData);

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename=sales-report.xlsx');

            await workbook.xlsx.write(res);
            res.end();
        }
    } catch (error) {
        console.error('Download Report Error:', error);
        res.status(500).send('Server error');
    }
}