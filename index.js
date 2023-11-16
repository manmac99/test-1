const express = require('express');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const mysql = require('mysql');
const crypto = require('crypto');
const config = require('./config');
//const session = require('express-session')
function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

var connection = mysql.createConnection({
    host: config.database.host,
    port: config.database.port,
    user: config.database.user,
    password: config.database.password,
    database: config.database.database
});

connection.connect(function(err) {
    if (err) {
        console.error('Error connecting to database:', err.stack);
        return;
    }
    console.log('Connected to database as id ' + connection.threadId);
});

const app = express();
const PORT = 8080;

app.use(bodyParser.json());

let transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: config.email.user,
        pass: config.email.pass,
    },
});

app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    const hashedPassword = hashPassword(password);
    connection.query('SELECT * FROM Customer_Info WHERE Email = ? AND Password = ?', [email, hashedPassword], function(err, results) {
        if (err) throw err;
        console.log(results);
        console.log(req.body);
        
        if (results.length > 0) {
            connection.query('SELECT Name FROM User_Info WHERE Email = ?', [email], function(err, nameResults) {
                if(err) throw err;

                if(nameResults.length > 0) {
                    //const userEmailFromSession = req.session.userEmail;

                    // 이름이 있다면
                    return res.status(200).json({
                        message: '로그인에 성공하셨습니다',
                        email: results[0].Email 
                    });
                } else {
                    // 이름이 없다면
                    const userEmailFromSession = req.body.userEmail;

                    return res.status(300).json({
                        message: '로그인에 성공하셨습니다',
                        email: results[0].Email 
                    });
                }
            });
        } else {
            return res.status(400).json({ message: '비밀번호가 틀렸습니다.' });
        }
    });
});


app.post('/api/send_verification', (req, res) => {
    const email = req.body.email;
    const verificationCode = Math.floor(1000 + Math.random() * 9000); // Generate 4-digit code

    connection.query('SELECT Password FROM Customer_Info WHERE Email = ?', [email], function(err, results) {
        if (err) throw err;
        if (results.length > 0) {
            return res.status(400).json({ message: '해당 이메일은 이미 가입되어 있습니다' });
        } else {
            connection.query('INSERT INTO Customer_Info (Email, VeriCode) VALUES (?, ?)', [email, verificationCode], function(err, results) {
                if (err) throw err;
                const mailOptions = {
                    from: 'lgaranara@gmail.com',
                    to: email,
                    subject: '메디헤어 인증번호',
                    text: `인증코드는 ${verificationCode}입니다.`,
                };
                transporter.sendMail(mailOptions, (error, info) => {
                    if (error) {
                        return res.status(500).json({ error: 'Error sending email' });
                    }
                    console.log("Email Sent!");
                    return res.status(200).json({ message: 'Email sent' });
                });
            });
        }
    });
});

app.post('/api/submit_info', (req, res) => {
    const { name, age, email,sex,nickname } = req.body;
    if (!name || !age) {
        return res.status(400).json({ message: '이름과 나이를 모두 제공해야 합니다.' });
    }

    connection.query('INSERT INTO User_Info (Name, User_Age, Email, Sex, nickname) VALUES (?, ?,?, ?,?) ', [name, age, email, sex, nickname], function (err, results) {
        if (err) {
            console.error('DB Error:', err);
            return res.status(500).json({ error: 'DB에 저장하는 도중 오류가 발생했습니다.' });
        }
            return res.status(200).json({ message: '정보가 성공적으로 저장되었습니다.' });
    });
    
});

app.post('/api/verify_code', (req, res) => {
    const { email, code } = req.body;
    connection.query('SELECT * FROM Customer_Info WHERE Email = ? AND VeriCode = ?', [email, code], function(err, results) {
        if (err) throw err;
        if (results.length > 0) {
            return res.status(200).json({ isVerified: true });
        } else {
            return res.status(400).json({ message: '인증번호가 틀렸습니다' });
        }
    });
});

app.post('/api/register', (req, res) => {
    const { email, password } = req.body;
    const hashedPassword = hashPassword(password);
    connection.query('UPDATE Customer_Info SET Password = ? WHERE Email = ?', [hashedPassword, email], function(err, results) {
        if (err) throw err;
        return res.status(200).json({ message: '회원가입 완료' });
    });
});

app.post('/api/Today_condition',(req,res)=>{
    const email = req.body.email;
    const currentDate = new Date().toISOString().split('T')[0];
    console.log(email, currentDate);
  const query = `
  SELECT  Hair_Density, Hair_Thickness, Hair_Loss_Type, Scalp_Condition, Hair_Age, Date
  FROM Hair_history
  WHERE U_email = ? AND Date = ?
  ORDER BY Times DESC
  LIMIT 1;
  `;

  connection.query('SELECT Name FROM User_Info WHERE Email = ?', [email], function(err, results) {
    if (err) {
        return res.status(500).json({ error: err.message });
    }
    const name = String(results[0].Name);
    console.log(name);


  connection.query(query, [email, currentDate], (err, results) => {
    if (err) {
      return res.status(500).send(err);
    }
    if (results.length === 0) {
      return res.status(404).send({ message: 'No record found for given email and date.' });
    }
    const modifiedResult = results[0];



    res.status(200).json({ modifiedResult: modifiedResult, name: name });
});
  });
  
});

app.post('/api/Choose_date', (req, res) => {
    const email = req.body.email;
    console.log(email);
    
    const query = `
        SELECT DISTINCT Date
        FROM Hair_history
        WHERE U_email = ?
        ORDER BY Date DESC;
    `;

    

    connection.query(query, [email], (err, results) => {
        console.log(results);
        if (err) {
            return res.status(500).send(err);
        }
        if (results.length === 0) {
            return res.status(404).send({ message: 'No dates found for the given email.' });
        }
        
        // Date 값을 'YYYY-MM-DD' 형식으로 변환 후 배열로 전송
        //const datesArray = results.map(result => result.Date.toISOString().split('T')[0]);
        const datesArray = results.map(result => new Date(result.Date).toISOString().split('T')[0]);

        res.status(200).send(datesArray);
    });
});


app.post('/api/Choosen_date',(req,res)=>{
    const email = req.body.email;
    const currentDate = req.body.date;
    console.log(email, currentDate);

  const query = `
  SELECT  Hair_Density, Hair_Thickness, Hair_Loss_Type, Scalp_Condition, Hair_Age, Date
  FROM Hair_history
  WHERE U_email = ? AND Date = ?
  ORDER BY Times DESC
  LIMIT 1;
  `;
  connection.query('SELECT Name FROM User_Info WHERE Email = ?', [email], function(err, results) {
    if (err) {
        return res.status(500).json({ error: err.message });
    }
    const name = String(results[0].Name);
    console.log(name);
  connection.query(query, [email, currentDate], (err, results) => {
    if (err) {
      return res.status(500).send(err);
    }
    if (results.length === 0) {
      return res.status(404).send({ message: 'No record found for given email and date.' });
    }
  
    const modifiedResult = results[0];


    res.status(200).json({ modifiedResult: modifiedResult, name: name });
    
  });
});
});

app.post('/api/Solution', (req, res) => {
    const email = req.body.email;

  const query = `
  SELECT  Hair_Density, Hair_Thickness, Hair_Loss_Type, Scalp_Condition, Hair_Age, Date
  FROM Hair_history
  WHERE U_email = ? 
  ORDER BY Times DESC
  LIMIT 1;
  `;
  connection.query(query, [email], (err, results) => {
    if (err) {
      return res.status(500).send(err);
    }
    if (results.length === 0) {
      return res.status(404).send({ message: 'No record found for given email and date.' });
    }
    
    const modifiedResult = results[0];
    console.log(modifiedResult);
    res.status(200).send(modifiedResult);
    

    
  });

});

app.post('/api/Get_Nickname', (req, res) => { //채팅 기능 구현할때 수정하기
    const email = req.body.email;
    connection.query('SELECT nickname FROM User_Info WHERE Email = ?', [email], function(err, results) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (results.length > 0) {
        console.log(results)
        const nickname = String(results[0].nickname);
        res.json({ name: nickname, email: email }); // 객체로 전달
      } else {
        res.status(404).json({ message: 'No user found with the given email.' });
      }
    });
  });

  app.post('/api/Get_U_Name', (req, res) => { //채팅 기능 구현할때 수정하기
    const email = req.body.email;
    connection.query('SELECT Name FROM User_Info WHERE Email = ?', [email], function(err, results) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (results.length > 0) {
        console.log(results)
        const name = String(results[0].Name);
        res.json({ name: name, email: email }); // 객체로 전달
      } else {
        res.status(404).json({ message: 'No user found with the given email.' });
      }
    });
  });
  

app.post('/api/Hair_Analyze', (req, res) => {
    const Hair_Loss_Types = ['전면탈모', '중앙탈모', '후면탈모', '탈모 아님'];
    const Scalp_Conditions = ['양호', '최상', '심각'];
    const currentDate = new Date().toISOString().split('T')[0];
    
    // 1. Hair_Loss_Type에 Hair_Loss_Types 중 하나를 랜덤으로 설정
    const Hair_Loss_Type = Hair_Loss_Types[Math.floor(Math.random() * Hair_Loss_Types.length)];

    // 2. '탈모 아님'이라면 Hair_Density와 Scalp_Condition 설정
    let Hair_Density, Hair_Thickness, Scalp_Condition;
    if (Hair_Loss_Type === '탈모 아님') {
        Hair_Density = 40;
        Hair_Thickness = 120;
        Scalp_Condition = '최상';
    } else {
        // 3. '전면탈모', '중앙탈모', '후면탈모' 중 하나라면 Scalp_Condition 설정
        Scalp_Condition = Scalp_Conditions[Math.floor(Math.random() * Scalp_Conditions.length)];

        // 4. Scalp_Condition이 '양호'라면 Hair_Density와 Hair_Thickness 설정
        if (Scalp_Condition === '양호') {
            Hair_Density = Math.floor(Math.random() * 11) + 20; // 20~30 사이의 랜덤 값
            Hair_Thickness = Math.floor(Math.random() * 21) + 50; // 50~70 사이의 랜덤 값
        }
        
        // 5. Scalp_Condition이 '심각'이라면 Hair_Density와 Hair_Thickness 설정
        else if (Scalp_Condition === '심각') {
            Hair_Density = Math.floor(Math.random() * 10) + 10; // 10~19 사이의 랜덤 값
            Hair_Thickness = Math.floor(Math.random() * 20) + 30; // 30~49 사이의 랜덤 값
        }
    }
    const tHair_Density  = Hair_Density;
    const tHair_Thickness = Hair_Thickness;
    const tScalp_Condition = Scalp_Condition;
    const email = req.body.email;


    connection.query('INSERT INTO Hair_history (Hair_Density,Hair_Thickness,Hair_Loss_Type,Scalp_Condition,Hair_Age, Date, U_email) VALUES (?,?,?,?,?,?,?) ', [  tHair_Density,tHair_Thickness,Hair_Loss_Type,tScalp_Condition,25, currentDate, email ], function(err, results) {
        if(err){
            return res.status(500).send(err);
        }
    });
    
    const query = `
    SELECT *
    FROM Hair_history
    WHERE U_email = ? AND Date = ?
    ORDER BY Times DESC
    LIMIT 1;
    `;
    connection.query('SELECT Name FROM User_Info WHERE Email = ?', [email], function(err, results) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        const name = String(results[0].Name);
        console.log(name);
    
        connection.query(query, [email, currentDate], (err, results) => {
            console.log(results);
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            if (results.length === 0) {
                return res.status(404).json({ message: 'No record found for given email and date.' });
            }
            const modifiedResult = results[0];
            res.status(200).json({ hairData: modifiedResult, userName: name });
        });
    });
});



app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
