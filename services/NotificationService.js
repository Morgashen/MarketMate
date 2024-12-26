const nodemailer = require('nodemailer');
const config = require('config');

class NotificationService {
    constructor() {
        this.transporter = nodemailer.createTransport(config.get('emailConfig'));
    }

    async sendOrderConfirmation(order, user) {
        const template = this.getOrderConfirmationTemplate(order);
        await this.sendEmail(user.email, 'Order Confirmation', template);
    }

    async sendShippingUpdate(order, user, trackingInfo) {
        const template = this.getShippingUpdateTemplate(order, trackingInfo);
        await this.sendEmail(user.email, 'Shipping Update', template);
    }

    async sendEmail(to, subject, html) {
        try {
            await this.transporter.sendMail({
                from: config.get('emailConfig.from'),
                to,
                subject,
                html
            });
        } catch (error) {
            console.error('Email sending failed:', error);
            // Continue execution even if email fails
        }
    }

    getOrderConfirmationTemplate(order) {
        return `
      <h2>Order Confirmation</h2>
      <p>Order Number: ${order.orderNumber}</p>
      <p>Total: $${order.total.toFixed(2)}</p>
      ...
    `;
    }
}