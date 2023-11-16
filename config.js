require('dotenv').config();

module.exports = {
    database: {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME
    },
    email: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
};
