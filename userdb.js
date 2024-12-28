const mysql = require('mysql2');
const dotenv = require('dotenv');
dotenv.config();

// 创建数据库连接
const connection = mysql.createConnection({
  host: process.env.DB_HOST, // 数据库地址
  user: process.env.DB_USER,      // 数据库用户名
  password: process.env.DB_PASSWORD, // 数据库密码
  database: process.env.DB_BASE, // 数据库名称
  port: process.env.DB_PORT,        // 端口号
  connectTimeout: 10000, // 设置连接超时时间为10秒
  waitForConnections: true,  // 等待连接
  connectionLimit: 10,  // 连接池最大连接数
  queueLimit: 0  // 无限制排队
});

// 连接数据库
connection.connect((err) => {
  if (err) {
    console.error('连接失败: ' + err.stack);
    return;
  }
  console.log('成功连接到数据库');
});

 function insertUser(userid, address) {
    return new Promise((resolve, reject) => {
        const query = 'INSERT INTO user (userId, address) VALUES (?, ?)';
        connection.query(query, [userid, address], (err, result) => {
            if (err) {
                console.error('插入失败:', err);
                reject(false); // 抛出错误
            } else {
                console.log('插入成功，用户ID:', userid); // 显示插入的用户ID
                resolve(result); // 返回查询结果
            }
        });

    });
}

 function deleteUser(userid,ctx) {
    return new Promise((resolve, reject) => {
        const query = 'DELETE FROM user WHERE userId = ?';
        connection.query(query, [userid], (err, result) => {
            if (err) {
                ctx.reply(`operation failure`);
                reject(false); // 抛出错误
            } else {
                console.log('删除成功:', result);
                resolve(result); // 返回查询结果
            }
        });
    });
}

 function updateUser(userid, address) {
  const query = 'UPDATE user SET address = ? WHERE userId = ?';
  connection.query(query, [address, userid], (err, result) => {
    if (err) {
      console.error('更新失败:', err);
   
    } else {
      console.log('更新成功:', result);
      
    }
  });
}

function getUser(userid) {
    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM user WHERE userId = ?';
      connection.query(query, [userid], (err, result) => {
        if (err) {
          console.error('查询失败:', err);
          reject(false); // 抛出错误
        } else {
          console.log('查询结果:', result);
          resolve(result.length==0?false:result[0]); // 返回查询结果
        }
      });
    });
}
  
function getAllUsers() {
    const query = 'SELECT * FROM user';
    connection.query(query, (err, result) => {
      if (err) {
        console.error('查询所有用户失败:', err);
      } else {
        console.log('所有用户和地址:', result);
      }
    });
}


// 导出模块
module.exports = {
    insertUser,
    deleteUser,
    updateUser,
    getUser,
    getAllUsers
};