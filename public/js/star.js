import * as THREE from '/libs/three.module.js';
import { UnrealBloomPass } from '/libs/plugins/OBJLoader.js';

class CelestalSphere
{
	initialize()
	{
		this.hull=new THREE.Group();
		this.stars={};
	}
	add(word, lumen)
	{
		this.stars[word]=new StarWord(word, lumen);
		this.stars[word].attach(this.hull);
	}
	changeLumen(word, lumen)
	{
		this.stars[word].changeLumen(lumen);
	}
}

class StarWord
{
	initialize(word, lumen)
	{
		this.word=word;
		this.lumen=lumen;
		this.position=new THREE.Vector3.random3D;
		this.mesh=null;
		this.mesh_shader=null;
	}
	attach(parent)
	{
		if(this.mesh instanceof THREE.Object3D)
		{
			parent.add(this.mesh);
		}
	}
	changeLumen(lumen)
	{
		this.lumen = lumen;
	}
}

export { CelestalSphere, StarWord };