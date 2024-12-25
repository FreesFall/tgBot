const express = require('express');
const path = require('path');

const app = express();
const port = 3000;

// 提供静态文件（HTML 文件）
app.use(express.static(path.join(__dirname, 'public')));

app.listen(port, () => {
  console.log(`服务器已启动，访问 http://localhost:${port}`);
});
