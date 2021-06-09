var express = require('express'); 
var app = express(); //express를 실행하여 app object를 초기화 합니다.

app.use(express.static(__dirname + "/public")); // 경로/public route를 static 지점으로 설정합니다?

var port = 3000; // 사용할 포트 번호를 port 변수에 넣습니다. 
app.listen(port, function(){ // port변수를 이용하여 3000번 포트에 node.js 서버를 연결합니다.
  console.log('server on! http://localhost:'+port); //서버가 실행되면 콘솔창에 표시될 메세지입니다.
});