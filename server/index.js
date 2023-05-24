//Express Requirements
const express = require('express');
const app = express();

require('dotenv').config();

const session = require('express-session');
const { User } = require('../server/db/models.js');
//Importing path so that we can use the static files from client side
const path = require('path');


//Importing passport for auth
//Also importing the initializePassport function created in auth
const passport = require('passport');
require('./passportConfig');

//Importing other routes
const googleRouter = require('./routes/google');
const users = require('../server/routes/userData');

//Importing Axios helper functions for icebreaker API
const { getIcebreaker } = require('../server/helpers/icebreakers.js');
const { getVibe } = require('../server/helpers/vibe.js');

//Creating server variable to require http and using app/express to initialize the server
const server = require('http').createServer(app);

//Creating socket.io server instance that is attaching the server instance and enabling Cross-Origin Resource Sharing for the WebSocket Server
const io = require('socket.io')(server, { cors: { origin: '*' } });

//Parses incoming JSON requests
app.use(express.json());
app.use(express.static(path.resolve(__dirname, '../client/dist')));

app.use(session({
  secret: [process.env.COOKIE_KEY],
  resave: false,
  saveUninitialized: false,
  cookie: { }
}));


//Initialize Passport middleware and have the express server use it, makes it so the user doesn't have to keep logging in to authenticate requests
app.use(passport.initialize());
app.use(passport.session());


//Including other routers
app.use("/auth", googleRouter);
app.use('/users', users);

//building socket.io logic
//event emitter to check for connection
//create new socket/user on connection

io.on('connection', (socket) => {
  //socket event creation
  console.log('user connected. socket id: ', socket.id);
  //socket join method to add 2 users to a room to chat
  socket.join('room');
  //io.to('room').emit('user-joined');

  //to broadcast message just to one user and not to sender
  socket.on('chat-message', (message) => {
    console.log('server got the message', message);
    socket.broadcast.emit('chat-message', message);
  });
  //when the socket/user disconnects
  socket.on('disconnect', () => {
    console.log('user disconnected');
  });
});

// Icebreaker API request
app.get('/api', async (req, res) => {
  try {
    const response = await getIcebreaker();
    res.status(201).send(response.data.question);
  } catch (err) {
    console.error('Failed to log POST from API', err);
    res.sendStatus(500);
  }
});

// Save Icebreaker to DB
app.post('/api', async (req, res) => {
  const { icebreaker, googleId } = req.body;
  try {
    const user = await User.findOne({ where: { googleId }});
    if (user) {
      user.icebreaker = icebreaker;
      await user.save();
      res.sendStatus(201);
    } else {
      res.sendStatus(404);
    }
  } catch (err) {
    console.error('Failed to log POST from API', err);
    res.sendStatus(500);
  }
});

// Post bio to API for vibe check
app.post('/api/vibe', async (req, res) => {
  const { bio } = req.body;
  try {
    const response = await getVibe(bio);
    res.status(201).send(response.data);
  } catch (err) {
    console.error('Failed to POST vibe from API');
    res.sendStatus(500);
  }
});

//Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});



module.exports = {
  app,
};
