import * as THREE from '/libs/three.module.js';

import { CelestalSphere, StarWord } from './star.js';

const socket = io();


//scene & renderer
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 1, 1800);
const renderer = new THREE.WebGLRenderer({antialias:true});

//objects
const celestalSphere = new CelestalSphere();

function init()
{
	camera.position.set(0, 400, -500);

	scene.background = new THREE.Color(0x000000);

	//renderer setting
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );

	const container = document.getElementById("canvas");
	container.appendChild( renderer.domElement );
}



//socket 

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