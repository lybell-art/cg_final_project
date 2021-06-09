import { StarWord } from './star.js';

const socket = io();
const starList={};


function launch_star(e)
{
	const myStar=document.getElementById("my_star");
	console.log(myStar.value);
	if(myStar.value == "") return;
	socket.emit('launch_star', myStar.value);
	myStar.value="";
}

socket.on('initialize_star', function(db){
	console.log(db);
/*	for(let i=0;i<db.length;i++)
	{
		starList[db.word]=new StarWord(db.word,db.count);
	}
	console.log(starList);*/
});

document.getElementById("test_button").addEventListener('click',launch_star);

socket.on('broadcast_star', function(msg, lumen){
	const log=document.getElementById("log");
	log.append(msg + "_" + lumen + "\n");
});