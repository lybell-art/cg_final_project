import * as THREE from './libs/three.module.js';

import { getMouseSphereLocation } from './common.js';

class CelestalSphere
{
	constructor(parent)
	{
		this.hull=new THREE.Group();

		this.stars={};
		parent.add(this.hull);
	}
	get matrix()
	{
		return this.hull.matrix;
	}
	get invMatrix()
	{
		let mat=this.hull.matrix.clone();
		return mat.invert();
	}
	add(word, lumen, pos=null, transition=false)
	{
		if(this.stars[word] === undefined)
		{
			this.stars[word]=new StarWord(word, lumen, pos, transition);
			this.stars[word].attach(this.hull);
			if(transition) return this.stars[word];
		}
		return null;
	}
	changeLumen(word, lumen)
	{
		this.stars[word].changeLumen(lumen);
	}
	rotate(x, y)
	{
		const delta = 0.01;
		this.hull.rotation.y -= x*delta;
		this.hull.rotation.x -= y*delta;
		this.hull.rotation.x = THREE.MathUtils.clamp(this.hull.rotation.x, -Math.PI/2, Math.PI/2); 
	}
	pickStar(camera, mouse)
	{
		let scaleBase = (window.innerHeight/2) / Math.tan(Math.PI * camera.fov/360);
		let short={word:null, obj:null, mouseDist:null, dist:Infinity};

		for (let word in this.stars) {
			const star=this.stars[word];

			let absPos = star.getAbsolutePos(this.matrix);
			let distZ=camera.position.z - absPos.z;

			if(short.dist < distZ) continue;

			let scaleFactor = scaleBase / distZ ;
			let width=star.width * scaleFactor;
			let height=star.height * scaleFactor;
			let centerX=(absPos.x - camera.position.x) * scaleFactor;
			let centerY=(absPos.y - camera.position.y) * scaleFactor;

			if(Math.abs(centerX - mouse.x) < width/2 && Math.abs(centerY - mouse.y) < height/2)
			{
				short.word = word;
				short.obj = star;
				short.mouseDist = new THREE.Vector2(centerX - mouse.x, centerY - mouse.y);
				short.dist = distZ;
			}
		}
		if(short.obj == null) return null;
		return short;
	}
	dragStar(star, camera, mouse, delta)
	{
		let distance=star.dist;
		let newMouse=new THREE.Vector2(mouse.x + delta.x, mouse.y + delta.y);

		let newLoc=getMouseSphereLocation(camera, newMouse, distance);

		newLoc.applyMatrix4(this.invMatrix);
		star.position = newLoc;
	}
}

class StarWord
{
	constructor(word, lumen, pos=null, transition=false)
	{
		this.word=word;
		this._lumen=lumen;
		this.dist = Math.random()*200+600;

		const position=new THREE.Vector3().random();
		if(pos instanceof THREE.Vector3)
		{
			position.copy(pos);
		}
		else
		{
			position.normalize();
			position.multiplyScalar(this.dist);
		}


		const texData= makeTextMaterial(word, "#ffefac");
		this.texture = texData.tex;
		this.material=new THREE.SpriteMaterial({
			map:this.texture, 
			color:0xffffff, 
			transparent:true});

		//backMaterial
/*		const shader=lumenShaderMaterial;
		this.material= new THREE.ShaderMaterial( {
			fragmentShader: shader.fragmentShader,
			vertexShader: shader.vertexShader,
			uniforms: THREE.UniformsUtils.clone( shader.uniforms ),
			transparent: true
		} );
		this.material.uniforms['map'].value = this.texture;
		this.material.uniforms['lumen'].value = this.lumen / 5.0;*/

		this.mesh = new THREE.Sprite(this.material);
		this.mesh.position.copy(position);
		this.mesh.scale.set(texData.width * this.lumen, texData.height* this.lumen, 1.0);
		this.mesh.layers.enable(1); //bloom

		this.isTransition=transition;
		this.material.opacity=(transition) ? 0.0 : 1.0;
	}
	get position()
	{
		return this.mesh.position.clone();
	}
	get width()
	{
		return this.mesh.scale.x;
	}
	get height()
	{
		return this.mesh.scale.y;
	}
	get lumen()
	{
		return Math.log(this._lumen + 1) / Math.log(4);
	}
	set position(p)
	{
		if(p instanceof THREE.Vector3) this.mesh.position.copy(p);
	}
	attach(parent)
	{
		if(this.mesh instanceof THREE.Object3D)
		{
			parent.add(this.mesh);
		}
	}
	getAbsolutePos(matrix)
	{
		let absPos=this.position;
		absPos.applyMatrix4(matrix);
		return absPos;
	}
	changeLumen(lumen)
	{
		this._lumen = lumen;
		this.mesh.scale.set(texData.width * this.lumen, texData.height* this.lumen, 1.0);
	}
	update(delta)
	{
		if(!this.isTransition) return;
		if(this.material.opacity > 1.0)
		{
			this.material.opacity=1.0;
			this.isTransition=false;
			return;
		}
		this.material.opacity += delta;
	}
}

class StarParticle
{
	static amount = 12500;
	constructor()
	{
		const minRadius = 800;
		const maxRadius = 1250;

		this.geometry = new THREE.BufferGeometry();

		const positions = [];
		const sizes = [];
		const alphas = [];
		const alive = [];

		const color = new THREE.Color();

		for ( let i = 0; i < StarParticle.amount; i ++ ) {
			let newPos=spreadToSphere(minRadius, maxRadius);
			for(let j=0;j<3;j++) positions.push(newPos[j]);

			sizes.push( 20 );
			alphas.push( 1.0 );
			alive.push( 1.0 );

		}
		this.geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( positions, 3 ) );
		this.geometry.setAttribute( 'scale', new THREE.Float32BufferAttribute( sizes, 1 ).setUsage( THREE.DynamicDrawUsage ) );
		this.geometry.setAttribute( 'alpha', new THREE.Float32BufferAttribute( alphas, 1 ) );
		this.geometry.setAttribute( 'alive', new THREE.Float32BufferAttribute( alive, 1 ) );

		const shader = pointShader;
		const material = new THREE.ShaderMaterial( {
			fragmentShader: shader.fragmentShader,
			vertexShader: shader.vertexShader,
			uniforms: THREE.UniformsUtils.clone( shader.uniforms )
		} );
		material.uniforms['color'].value=new THREE.Color( 0xbb80bb );

		this.hull = new THREE.Points( this.geometry, material );
		this.hull.opacity = 0.5;
		this.hull.layers.enable(1); //bloom
	}
	attach(parent)
	{
		parent.add(this.hull);
	}
	twinkle(time=0)
	{
		const sizes = this.hull.geometry.attributes.scale.array;
		for ( let i = 0; i < StarParticle.amount; i++ ) {
			let x=0.1 * i + time;
			sizes[i] = 10 * (0.5 + Math.pow(Math.sin(x), 3.0) * Math.sin(x+1.3) * 2.0);
		}
		this.hull.geometry.attributes.scale.needsUpdate = true;
		this.hull.material.uniforms['color'].value = new THREE.Color().setHSL((time * 0.2) % 1.0, 1.0, 0.8);
	}
}

class Particle
{
	constructor()
	{
		this.position=new THREE.Vector3();
		this.direction=new THREE.Vector3();
		this.speed=0;
		this.scale=20.0;
		this.age=0.0;
		this.alive=0.0;
	}
	get alpha()
	{
		if(this.age < 0.5) return 1.0;
		else return 1-(this.age-0.5)/0.5;
	}
	get isAlive()
	{
		return this.age < 1.0;
	}
	initialize(pos, dir)
	{
		this.position=pos.clone();
		this.direction=dir.clone().negate().normalize();
		this.direction.x+=Math.random()*0.3 - 0.15;
		this.direction.y+=Math.random()*0.3 - 0.15;
		this.direction.z+=Math.random()*0.3 - 0.15;
		this.speed=( 3 + (Math.random() * 2 - 1) ) * 0.5;
		this.age=0.0;
		this.alive=1.0;
	}

	update(delta)
	{
		if(this.alive > 0.9)
		{
			this.age += delta;
			this.position.addScaledVector(this.direction, this.speed);
		}
	}
	destroy()
	{
		this.age=0.0;
		this.alive=0.0;
	}
}


class LaunchParticle
{
	static amount = 500;
	constructor(pos, dir, speed, isGravityApplied=true)
	{
		this._position=pos.clone();
		let _direction=new THREE.Vector3().copy(dir).normalize();
		this._velocity=_direction.clone().multiplyScalar(speed);
		this.particles=[];
		this.isGravityApplied = isGravityApplied;

		this.geometry = new THREE.BufferGeometry();


		let positions=[]; let sizes=[]; let alphas=[]; let alives=[];
		for ( let i = 0; i < LaunchParticle.amount; i ++ ) {
			this.particles.push(new Particle());
			for(let j=0;j<3;j++) positions.push(0.0);

			sizes.push( 2 );
			alphas.push( 1.0 );
			alives.push( 0.0 );

		}

		this.geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( positions, 3 ).setUsage( THREE.DynamicDrawUsage ) );
		this.geometry.setAttribute( 'scale', new THREE.Float32BufferAttribute( sizes, 1 ) );
		this.geometry.setAttribute( 'alpha', new THREE.Float32BufferAttribute( alphas, 1 ).setUsage( THREE.DynamicDrawUsage ) );
		this.geometry.setAttribute( 'alive', new THREE.Float32BufferAttribute( alives, 1 ).setUsage( THREE.DynamicDrawUsage ) );

		const shader = pointShader;
		const material = new THREE.ShaderMaterial( {
			fragmentShader: shader.fragmentShader,
			vertexShader: shader.vertexShader,
			uniforms: THREE.UniformsUtils.clone( shader.uniforms ),
			transparent:true,
			blending: THREE.AdditiveBlending 
		} );
		material.uniforms['color'].value=new THREE.Color( 0xffffcc );

		this.hull = new THREE.Points( this.geometry, material );
		this.hull.layers.enable(1); //bloom

		this.newParticleAge=0.0;
		this.pendingDeath=false;
		this.isDead=false;
	}
	get position()
	{
		return this._position.clone();
	}
	get speed()
	{
		return this._velocity.length();
	}
	get direction()
	{
		let vel=this._velocity.clone();
		return vel.normalize();
	}
	set position(e)
	{
		this.position.copy(e);
	}
	attach(parent)
	{
		parent.add(this.hull);
	}

	moveTo(newPos)
	{
		if(this.pendingDeath) return;

		let prePos=this.position;
		this.position = newPos;
		this.velocity = newPos.clone().sub(prePos);
	}
	thrust()
	{
		if(this.pendingDeath) return;

		if(this.isGravityApplied) this._velocity.y -= 0.01;
		this._position.add(this._velocity);
	}
	update(delta)
	{
		const newParticleInterval = 0.05;

		const positions = this.hull.geometry.attributes.position.array;
		const alphas = this.hull.geometry.attributes.alpha.array;
		const alives = this.hull.geometry.attributes.alive.array;

		const recyclesIndices=[];
		let livingParticle=0;

		for (let i = 0; i < LaunchParticle.amount; i++)
		{
			if ( this.particles[i].alive > 0.9)
			{
				this.particles[i].update(delta);

				if ( !this.particles[i].isAlive ) 
				{
					this.particles[i].destroy();
					recyclesIndices.push(i);
				}

				// update particle properties in shader
				positions[i*3] = this.particles[i].position.x;
				positions[i*3+1] = this.particles[i].position.y;
				positions[i*3+2] = this.particles[i].position.z;
				alphas[i] = this.particles[i].alpha;
				alives[i] = this.particles[i].alive;

				livingParticle++;
			}
			else recyclesIndices.push(i);
		}
		this.hull.geometry.attributes.position.needsUpdate = true;
		this.hull.geometry.attributes.alpha.needsUpdate = true;
		this.hull.geometry.attributes.alive.needsUpdate = true;

		if(this.pendingDeath)
		{
			if(livingParticle == 0) this.destroy();
			return;
		}

		if(this.newParticleAge > newParticleInterval)
		{
			for(let i=0;i<Math.min(5, recyclesIndices.length);i++)
			{
				let indice=recyclesIndices[i];
				this.particles[indice].initialize(this.position, this.direction);
			}
			this.newParticleAge -= newParticleInterval;
		}
		this.newParticleAge+=delta;
	}

	callDestroy()
	{
		this.pendingDeath=true;
	}

	destroy()
	{
		this.isDead=true;
		let lastPos=this.position;
		this.hull.clear();
		let parent=this.hull.parent;
		parent.remove(this.hull);
		return lastPos;
	}
}




function spreadToSphere(min, max)
{
	let pos = new THREE.Vector3();
	pos.x = Math.random() * 2 - 1;
	pos.y = Math.random() * 2 - 1;
	pos.z = Math.random() * 2 - 1;
	pos.normalize();
	let r=Math.random() * (max-min) + min;
	pos.multiplyScalar(r);
	return [pos.x, pos.y, pos.z];
}

function makeTextMaterial(text, color)
{
	const canvas=document.createElement('canvas');
	const context=canvas.getContext('2d');
	const fontSize=150;


	context.font = fontSize+"px Georgia";
	let metrix=context.measureText(text);
	canvas.width = metrix.width;
	canvas.height = fontSize * 1.2;

	context.font = fontSize+"px Noto Serif KR";
	context.fillStyle=color;
	context.fillText(text, 0, fontSize);

	document.body.appendChild(canvas);

	const texture=new THREE.Texture(canvas);
	texture.needsUpdate = true;
	return {tex:texture, width:canvas.width/5, height:canvas.height/5};
}

const lumenShaderMaterial = {
	uniforms:{
		'map': { value: null },
		'lumen': { value: 1.0}
	},
	vertexShader:`
	varying vec2 vUv;
	uniform float lumen;
	void main() {
		vUv = uv;
		gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
	}
	`,
	fragmentShader:`
	uniform sampler2D map;
	uniform float lumen;
	varying vec2 vUv;
	void main() {
		if(texture2D(map,vUv).a < 0.01) discard;
		gl_FragColor = vec4( lumen, lumen, lumen, 1.0);
	}
	`
}

const pointShader = {
	uniforms:{
		'color': { value: new THREE.Color( 0xffffff ) }
	},
	vertexShader:`
	attribute float scale;
	attribute float alpha;
	attribute float alive;

	varying float vAlpha;
	varying float vAlive;
	void main() {
		vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
		gl_PointSize = scale * ( 300.0 / - mvPosition.z );
		gl_Position = projectionMatrix * mvPosition;
		vAlpha = alpha;
		vAlive = alive;
	}
	`,
	fragmentShader:`
	uniform vec3 color;
	varying float vAlpha;
	varying float vAlive;

	void main() {
		if ( vAlive < 0.1) discard;
		if ( length( gl_PointCoord - vec2( 0.5, 0.5 ) ) > 0.475 ) discard;
		gl_FragColor = vec4( color, vAlpha );
	}
	`
}




export { CelestalSphere, StarWord, StarParticle, LaunchParticle };