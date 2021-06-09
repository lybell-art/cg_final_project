import * as THREE from './libs/three.module.js';
import { MTLLoader } from './libs/plugins/MTLLoader.js';
import { OBJLoader } from './libs/plugins/OBJLoader.js';

import { CelestalSphere, StarWord } from './star.js';

const socket = io();


//scene & renderer
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(45, window.innerWidth/window.innerHeight, 0.1, 1800);
const renderer = new THREE.WebGLRenderer({antialias:true});

//objects
const celestalSphere = new CelestalSphere();
let earth;

//get geolocation
let geolocation=null;

fetch ( 'https://ipapi.co/json/')
    .then (res => res.json ())
    .then ((out) => {
    	geolocation={latitude:null, longitude:null};
    	geolocation.latitude=out.latitude;
    	geolocation.longitude=out.longitude;
    	console.log(geolocation, earth);
}). catch (err => console.error (err));


function initEarth()
{
	new MTLLoader().load( 'assets/earth.mtl', function ( materials ) {
		materials.preload();
		const objLoader = new OBJLoader();
		objLoader.setMaterials( materials );
		objLoader.load( 'assets/earth.obj', function ( object ) {
			earth=object.children[0];
			earth.castShadow=true;
			earth.scale.multiplyScalar(25);
			console.log(geolocation, earth);
			scene.add(earth);
		});
	});
}

function lotateEarth()
{
	
}

function testSphere()
{
	const geometry = new THREE.SphereGeometry( 100, 32, 32 );
	const material = new THREE.MeshPhongMaterial( { color: 0x156289, emissive: 0x072534, side: THREE.DoubleSide, flatShading: true } );
	const sphere = new THREE.Mesh( geometry, material );
	scene.add( sphere );
}

function initLights()
{
	const lights = [];
	for(let i=0;i<4;i++) lights[i] = new THREE.PointLight(0xffffff, 1, 0);

	lights[ 0 ].position.set( 0, -400, 0 );
	lights[ 1 ].position.set( 0, 400, 400 );
	lights[ 1 ].power = 5.0;
	lights[ 2 ].position.set( -200, 400, -200 );
	lights[ 3 ].position.set( 200, 400, -200 );

	for(let i=0;i<4;i++) scene.add(lights[i]);

	for(let i=0;i<4;i++)
	{
		const helper = new THREE.PointLightHelper(lights[i], 1);
		scene.add(helper);
	}


	const ambient = new THREE.AmbientLight( 0xcccccc ); // soft white light
	scene.add( ambient );
}

function init()
{
	camera.position.set(0, 150, 400);

	scene.background = new THREE.Color(0x000000);

//	testSphere();
	initEarth();
	initLights();
	console.log(scene);
	//renderer setting
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );

	const container = document.getElementById("canvas");
	container.appendChild( renderer.domElement );

	window.addEventListener( 'resize', onWindowResize );
}
function animate()
{
	requestAnimationFrame( animate );
	render();
}
function render()
{
	renderer.render( scene, camera);
}
init();
animate();


function onWindowResize() {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize( window.innerWidth, window.innerHeight );
}

//socket 

socket.on('initialize_star', function(db){
	for(let i=0;i<db.length;i++)
	{
		let d=db[i];
//		celestalSphere.add(d.word,d.count);
	}
});

socket.on('broadcast_star', function(msg, lumen){
	const log=document.getElementById("log");
	log.append(msg + "\n");
//	console.log(starList);
});