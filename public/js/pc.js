import { StarWord } from './star.js';

const socket = io();
const starList={};

socket.on('initialize_star', function(db){
	for(let i=0;i<db.length;i++)
	{
		let d=db[i];
		starList[d.word]=new StarWord(d.word,d.count);
	}
	console.log(starList);
});

socket.on('broadcast_star', function(msg, lumen){
	const log=document.getElementById("log");
	log.append(msg + "\n");
//	console.log(starList);
});