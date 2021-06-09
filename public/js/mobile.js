const socket = io();

function launch_star(e)
{
	const myStar=document.getElementById("my_star");
	console.log(myStar);
	socket.emit('launch_star', myStar.value);
	myStar.value="";
}

document.getElementById("test_button").addEventListener('click',launch_star);

socket.on('broadcast_star', function(msg){
	const log=document.getElementById("log");
	log.append(msg + "\n");
});