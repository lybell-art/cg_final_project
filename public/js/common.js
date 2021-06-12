import * as THREE from './libs/three.module.js';
import { MTLLoader } from './libs/plugins/MTLLoader.js';
import { OBJLoader } from './libs/plugins/OBJLoader.js';

export let geolocation={latitude:null, longitude:null};
let earth=null;
let isBGMPlaying=false;
export let bgm=new THREE.Audio( new THREE.AudioListener );
export let isLoaded = false;

//get geolocation

function initGeolocation(loader)
{
	let url='https://ipapi.co/json/';
	console.log("geolocation!");
	if(loader !== undefined)
	{
		loader.itemStart( url );
	}

	fetch ( url )
	    .then (res => res.json ())
	    .then ((out) => {
	    	geolocation={latitude:null, longitude:null};
	    	geolocation.latitude=out.latitude;
	    	geolocation.longitude=out.longitude;
	    	if(earth != null) rotateEarth(earth, geolocation);

	    	if(loader !== undefined) loader.itemEnd(url);
	}). catch ((err) =>
	{
		console.error (err);
		if(loader !== undefined)
		{
			loader.itemError( url );
			loader.itemEnd( url );
		}
	});
}



function initEarth(scene, loader)
{
	const objLoader = new OBJLoader(loader);
	const mtlLoader = new MTLLoader(loader);

	mtlLoader.load( 'assets/obj/earth.mtl', function ( materials ) {
		materials.preload();
		objLoader.setMaterials( materials );
		objLoader.load( 'assets/obj/earth.obj', function ( object ) {
			earth=object.children[0];
			earth.castShadow=true;
			earth.scale.multiplyScalar(20);
			if(geolocation.latitude != null) rotateEarth(earth, geolocation);
			scene.add(earth);
		});
	});
}

function rotateEarth(earth, geolocation)
{
	const degree = Math.PI/180;
	earth.rotation.y = geolocation.longitude * degree;
	earth.rotation.x = -(90 - geolocation.latitude ) * degree;
}

function initLights(scene)
{
	const lights = [];
	for(let i=0;i<4;i++) lights[i] = new THREE.PointLight(0xffffff, 1, 0);

	lights[ 0 ].position.set( 0, -400, 0 );
	lights[ 1 ].position.set( 0, 400, 400 );
	lights[ 1 ].power = 5.0;
	lights[ 2 ].position.set( -200, 400, -200 );
	lights[ 3 ].position.set( 200, 400, -200 );

	for(let i=0;i<4;i++) scene.add(lights[i]);

	const ambient = new THREE.AmbientLight( 0xcccccc ); // soft white light
	scene.add( ambient );
}

function initSounds(loader)
{
	const audioLoader = new THREE.AudioLoader(loader);
	audioLoader.load("assets/sound/Shooting Star_Kazumus Sound.mp3", function ( audioBuffer ) {
		bgm.setBuffer( audioBuffer );
		bgm.setLoop(true);
	});
}

function initBGM()
{
	if(!isBGMPlaying) bgm.play();
	isBGMPlaying=true;
}

function initCommon(scene, loader=undefined)
{
	initGeolocation(loader);
	initEarth(scene, loader);
	initLights(scene);
	initSounds(loader);
}

function getMousePlaneLocation(camera, mousePos, dist)
{
	let pos=camera.position.clone();
	let dir=new THREE.Vector3();

	let cameraDist = (window.innerHeight/2) / Math.tan(Math.PI * camera.fov/360);
	dir.x = mousePos.x * dist / cameraDist ;
	dir.y = mousePos.y * dist / cameraDist;
	dir.z = -dist;

	pos.add(dir);
	return pos;
}


function getMouseSphereLocation(camera, mousePos, radius)
{
	let pos=camera.position.clone();
	let dir=new THREE.Vector3();
	dir.x = mousePos.x;
	dir.y = mousePos.y;
	dir.z = -(window.innerHeight/2) / Math.tan(Math.PI * camera.fov/360);
	dir.normalize();

	let a=dir.lengthSq();
	let b=2 * pos.dot(dir);
	let c=pos.lengthSq() - radius * radius;

	let D=b*b - 4*a*c;

	if(D < 0) return null;
	else
	{
		let rootD=Math.sqrt(D);
		let mult1=(-b+rootD)/(2*a);
		let mult2=(-b-rootD)/(2*a);
		if(mult1 < 0) mult1 = Infinity;
		if(mult2 < 0) mult2 = Infinity;
		let resMult=Math.min(mult1, mult2);
		return pos.addScaledVector(dir, resMult);
	}
}

function myLoadingComplete()
{
	const loadingScreen = document.getElementById( 'loading-screen' );
	loadingScreen.classList.add( 'fade-out' );
	loadingScreen.addEventListener( 'transitionend', (e)=>{e.target.remove(); isLoaded=true;} );

	window.addEventListener('click',initBGM);
}

export {rotateEarth, initCommon, getMousePlaneLocation, getMouseSphereLocation, myLoadingComplete};