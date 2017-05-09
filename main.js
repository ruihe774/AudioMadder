onload=function()
{
	var blackPlrSrc="data:image/bmp;base64,Qk1CAAAAAAAAAD4AAAAoAAAAAQAAAAEAAAABAAEAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP///wAAAAAA";
	var lci=document.getElementById("lChannelImg");
	var rci=document.getElementById("rChannelImg");
	var vec=document.getElementById("vec");
	onresize=function()
	{
		lci.style.transform="scale("+(innerWidth/lci.width-0.002)+","+((innerHeight-vec.offsetHeight)/2/lci.height-0.002)+")";
		rci.style.transform="scale("+(innerWidth/rci.width-0.002)+","+((innerHeight-vec.offsetHeight)/2/rci.height-0.002)+")";
		lci.style.top=vec.offsetHeight+"px";
		rci.style.top=((innerHeight-vec.offsetHeight)/2/lci.height-0.002)*lci.height+vec.offsetHeight+"px";
	}
	onresize();
	lci.src=blackPlrSrc;
	rci.src=blackPlrSrc;
	var btn=document.getElementById("audioFileSubmit");
	var inf=document.getElementById("audioFile");
	var fil,filnam;
	var atx,oatx,ocs,obf,omg,oay1,oay2,scn;
	var lc,rc,lcc,rcc,lim,rim;
	var skipframe=4096;
	var fre,ret,ccl,arr1,arr2,row;
	var stm;
	window.AudioContext=window.AudioContext||window.webkitAudioContext;
	window.OfflineAudioContext=window.OfflineAudioContext||window.webkitOfflineAudioContext;
	if(!(window.requestAnimationFrame=window.requestAnimationFrame||window.webkitRequestAnimationFrame||window.mozRequestAnimationFrame||window.oRequestAnimationFrame))
	{
		alert('Your browser does not support requestAnimationFrame');
	}
	function gc()
	{
		atx=oatx=ocs=obf=omg=oay1=oay2=scn=null;
		lc=rc=lcc=rcc=lim=rim=null;
		fre=ret=ccl=arr1=arr2=row=null;
	}
	function setGrayPixlr(imd,x,y,g)
	{
		var w=imd.width,h=imd.height;
		var pos=y*imd.width+x;
		pos*=4;
		imd.data[pos]=g;
		imd.data[pos+1]=g;
		imd.data[pos+2]=g;
	}
	btn.onclick=function()
	{
		stm=new Date().getTime();
		btn.disabled=true;
		document.getElementById("dot").innerHTML="|";
		fil=inf.files[0];
		filnam=fil.name;
		fre=new FileReader;
		fre.onload=function(e)
		{
			ret=e.target.result;
			console.log("Decoding...");
			try
			{
				atx=new window.AudioContext();
			} catch (e) {
				alert('Your browser does not support AudioContext');
			}
			atx.decodeAudioData(ret,function(buf)
			{
				try
				{
					oatx=new window.OfflineAudioContext(buf.numberOfChannels,buf.length,buf.sampleRate);
				} catch (e) {
					alert('Your browser does not support OfflineAudioContext');
				}
				obf=oatx.createBufferSource();
				obf.buffer=buf;
				ocs=oatx.createChannelSplitter(2);
				obf.connect(ocs);
				omg=oatx.createChannelMerger(2);
				oay1=oatx.createAnalyser();
				oay2=oatx.createAnalyser();
				oay1.fftSize=oay2.fftSize=2048;
				ocs.connect(oay1,0);
				ocs.connect(oay2,1);
				oay1.connect(omg,0,0);
				oay2.connect(omg,0,1);
				scn=oatx.createScriptProcessor(skipframe,1,1);
				omg.connect(scn);
				lc=lci;
				lc.mozOpaque=true;
				lc.width=Math.ceil(obf.buffer.length/skipframe);
				lc.height=oay1.frequencyBinCount;
				lcc=lc.getContext("2d");
				lcc.fillStyle="#000000";
				lcc.fillRect(0,0,lc.width,lc.height);
				rc=rci;
				rc.mozOpaque=true;
				rc.width=Math.ceil(obf.buffer.length/skipframe);
				rc.height=oay2.frequencyBinCount;
				rcc=rc.getContext("2d");
				rcc.fillStyle="#000000";
				rcc.fillRect(0,0,rc.width,rc.height);
				onresize();
				ccl=0;
				arr1= new Uint8Array(oay1.frequencyBinCount);
				arr2= new Uint8Array(oay2.frequencyBinCount);
				lim=lcc.getImageData(0,0,lc.width,lc.height);
				rim=rcc.getImageData(0,0,rc.width,rc.height);
				scn.onaudioprocess=function()
				{
					
					oay1.getByteFrequencyData(arr1);
					
					oay2.getByteFrequencyData(arr2);
					for(row=0;row<arr1.length;++row)
					{
						//lcc.fillStyle="rgb("+arr1[row]+","+arr1[row]+","+arr1[row]+")";
						//lcc.fillRect(ccl,arr1.length-row-1,1,1);
						setGrayPixlr(lim,ccl,arr1.length-row-1,arr1[row]);
					}
					for(row=0;row<arr2.length;++row)
					{
						//rcc.fillStyle="rgb("+arr2[row]+","+arr2[row]+","+arr2[row]+")";
						//rcc.fillRect(ccl,arr2.length-row-1,1,1);
						setGrayPixlr(rim,ccl,arr2.length-row-1,arr2[row]);
					}
					++ccl;
					if(ccl%Math.round(oatx.sampleRate/skipframe)==0)
					{
						document.getElementById("dot").innerHTML+=".";
					}
				}
				scn.connect(oatx.destination);
				console.log("Drawing...");
				obf.start(0);
				oatx.startRendering().then(function()
				{
					lcc.putImageData(lim,0,0);
					rcc.putImageData(rim,0,0);
					var space=lc.height/6;
					lcc.fillStyle="orange";
					for(var y=space;Math.ceil(y)<lc.height;y+=space)
						lcc.fillRect(0,Math.round(y),lc.width,2);
					space=rc.height/6;
					rcc.fillStyle="orange";
					for(var y=space;Math.ceil(y)<rc.height;y+=space)
						rcc.fillRect(0,Math.round(y),rc.width,2);
					//lci.src=lc.toDataURL("image/png");
					//rci.src=rc.toDataURL("image/png");
					gc();
					console.log("Finish");
					btn.disabled=false;
					console.log("Spend "+(new Date().getTime()-stm)+"ms");
					stm=null;
				}).catch(function()
				{
					gc();
					alert("Error!");
					btn.disabled=false;
				});
			},
			function()
			{
				alert("Failure to decode");
			});
		}
		console.log("Reading...");
		fre.readAsArrayBuffer(fil);
	}
}
