const express = require('express');
const MobileDetect=require('mobile-detect');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);

//initialize app
app.use(express.static('public'));

app.get("/",(req,res)=>{
  //mobile page redirection
  let md=new MobileDetect(req.headers['user-agent']);
  let isMobile=Boolean(md.os());
  console.log(isMobile);
  if(isMobile) res.redirect("/mobile");

  res.sendFile("index.html", { root: __dirname+"/public" });
});

app.get("/mobile",(req,res)=>{
  res.sendFile("mobile.html", { root: __dirname+"/public" });
});


//socket

io.on('connection', function(socket){
  console.log('user connected: ', socket.id);

  socket.on('disconnect', function(){
    console.log('user disconnected: ', socket.id);
  });


  socket.on('launch_star', function(text){
    console.log(text);
    io.emit('broadcast_star', text);
  });

});



let port = 3000;
http.listen(port, function(){ 
  console.log('server on! http://localhost:'+port);
});