const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('Node app draait op Render 🚀');
});

server.listen(process.env.PORT || 3000, () => {
  console.log('Server draait');
});