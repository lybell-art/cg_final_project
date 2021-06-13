const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http); // to use real-time experirence

const MobileDetect=require('mobile-detect'); // to mobile detection & redirection
const mongoose = require('mongoose'); // to use db

//DB initialize

mongoose.set('useNewUrlParser', true);
mongoose.set('useFindAndModify', false);
mongoose.set('useCreateIndex', true);
mongoose.set('useUnifiedTopology', true);
mongoose.connect(process.env.MONGO_DB);
const db = mongoose.connection;
db.once('open', ()=>console.log("DB successfully connected"));
db.on('error',(err)=>console.log("DB connection failed : ", err));

const schema = mongoose.Schema({
  word: {type:String, required:true, unique:true},
  count:{type:Number}
});
const starModel = mongoose.model('star_list',schema)


function loadDB()
{
  console.log("DB Loaded!");
  starModel.find({}, function(err, res){
    if(err) console.log("Error!", err);
    else io.emit('initialize_star', res);
  });
}

function addDB(data, callback)
{
  starModel.findOne({word:data}, function(err, res){
    if(err) {console.log("Error!", err); return;}
    
    let lumen = 0;
    // if your word is new
    if(res == null)
    {
      starModel.create({word:data, count:1});
      lumen=1;
    }
    // if someone already posted your word
    else
    {
      lumen=res.count+1;
      starModel.findOneAndUpdate({word:data},
        {word:data, count:lumen},
        {new : true},
        (err, c)=>{});
    }
    callback(data, lumen);
//    io.emit('broadcast_star', data, lumen);
  });
}

//initialize app

app.get("/",(req,res)=>{
  //mobile page redirection
  let md=new MobileDetect(req.headers['user-agent']);
  let isMobile=Boolean(md.os());
  console.log(isMobile);
  if(isMobile) res.redirect("/mobile");
  else
  {
    loadDB();
    res.sendFile("index.html", { root: __dirname+"/public" });
  }
  
});

app.get("/mobile",(req,res)=>{
  loadDB();
  res.sendFile("mobile.html", { root: __dirname+"/public" });
});

app.use(express.static('public'));


//socket

io.on('connection', function(socket){
  console.log('user connected: ', socket.id);

  socket.on('disconnect', function(){
    console.log('user disconnected: ', socket.id);
  });


  socket.on('launch_star', function(datum)
  {
    console.log("Launched!");
    addDB(datum.text, 
      function(text, lumen)
      {
        console.log("DB Added!");
        io.emit('broadcast_star', text, datum.gyro, datum.loc, lumen);
      }
    );
  }
  );

  socket.on('debug', function(text){
    console.log(text);
  });

});



let port = 3000;
http.listen(port, function(){ 
  console.log('server on! http://localhost:'+port);
});