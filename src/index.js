const express = require('express')
const path = require('path')
const http = require('http')
const socketio = require('socket.io')
const Filter = require('bad-words')
const { generateMessage } = require('./utils/messages')
const { addUser, removeUser, getUser, getUserInRoom } = require('./utils/users')

const app = express()
const server = http.createServer(app)
const io = socketio(server)

const port = process.env.PORT || 3000
const publicDirPath = path.join(__dirname, '../public')

app.use(express.static(publicDirPath))

io.on('connection', (socket) => {
    console.log('new websocket connection')

    // Emite somente para aquele cliente
    // socket.emit('message', generateMessage('Welcome!'))

    //Emite para todos os clientes, menos aquele que acabou de entrar
    // socket.broadcast.emit('message', generateMessage('A new user has joined'))

    socket.on('join', (options, callback) => {
        const { error, user } = addUser({ id: socket.id, ...options })

        if (error) {
            return callback(error)
        }

        socket.join(user.room)

        socket.emit('message', generateMessage(user.username, 'Welcome to the chat room!'))
        socket.broadcast.to(user.room).emit('message', generateMessage(user.username, `${user.username} has joined the room`))
        io.to(user.room).emit('roomData', {
            room: user.room,
            users: getUserInRoom(user.room)
        })

        callback()

        // socket.emit, io.emit, socket.broadcast.emit
        // io.to.emit, socket.broadcast.to.emit
    })

    socket.on('sendMessage', (msg, callback) => {
        const user = getUser(socket.id)
        const filter = new Filter()

        if (filter.isProfane(msg))
            return callback('Profanity is not allowed')

        // Emite para todos os clientes
        io.to(user.room).emit('message', generateMessage(user.username, msg))
        callback()
    })

    socket.on('location', ({ latitude, longitude }, callback) => {
        const user = getUser(socket.id)

        io.to(user.room).emit('locationMessage', generateMessage(user.username, `https://google.com/maps?q=${latitude},${longitude}`))

        callback()
    })

    socket.on('disconnect', () => {
        const user = removeUser(socket.id)

        if (user) {
            io.to(user.room).emit('message', generateMessage(user.username, `${user.username} has left the room`))
            io.to(user.room).emit('roomData', {
                room: user.room,
                users: getUserInRoom(user.room)
            })
        }
    })
})

server.listen(port, () => {
    console.log(`Server is up on port ${port}`)
})