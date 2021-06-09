const socket = io();


socket.on('broadcast_star', function(msg){
	const log=document.getElementById("log");
	log.append(msg + "\n");
});