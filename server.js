const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const { APP_ENV = 'dev', APP_TITLE = 'Live Chat', JOIN_CODE, BUILD_NUMBER = 'local' } = process.env;

app.use(express.static('public'));
app.get('/health', (req, res) => res.send('OK'));
app.get('/config', (req, res) => res.json({ title: APP_TITLE, env: APP_ENV, build: BUILD_NUMBER }));

io.on('connection', (socket) => {
  socket.on('join', ({ name, code }) => {
    if (JOIN_CODE && code !== JOIN_CODE) return socket.emit('denied');
    socket.data.name = String(name || 'Guest').slice(0, 20);
    socket.emit('joined');
    io.emit('system', `${socket.data.name} joined`);
    io.emit('online', io.engine.clientsCount);
  });

  socket.on('message', (text) => {
    if (!socket.data.name) return;
    io.emit('message', {
      name: socket.data.name,
      text: String(text).slice(0, 500),
      time: new Date().toLocaleTimeString(),
    });
  });

  socket.on('disconnect', () => {
    if (socket.data.name) io.emit('system', `${socket.data.name} left`);
    io.emit('online', io.engine.clientsCount);
  });
});

server.listen(3000, () => console.log(`Chat running (${APP_ENV}) build ${BUILD_NUMBER}`));