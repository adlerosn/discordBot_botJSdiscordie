//Discord Credentials
var discordusr = ""; //fill here
var discordpss = ""; //fill here

//Database connection string (PostgreSQL only, MySQL not supported)
var conString = "postgres://"; //fill here
//               postgres://username:password@localhost/databasename

//Username in unix-like environment (don't remove the slashes)
var unixuserfoldername='/kiror/';

//Forwarded ports you need have (edit if yours are different)
var httpport='8000';
var sshport ='8003';

//The user that is running this on his machine
var absolutemaster=''; //Put your userID here

//The trusted users who can use annoying commands
var masters = [absolutemaster,'']; //add people who can control the bot

//The version string
var botver='0.0.2';

////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////

var Discordie = require("discordie");
var Events = Discordie.Events;

var client = new Discordie();

var cpath = require('path').dirname(require.main.filename);
var os = require("os");
var fs = require('fs');
var path = require('path');
var child_process = require('child_process');
var request = require('request');
var pg = require('pg');
var exec = require('child_process').exec;

var musicfile="test.mp3"; //just an initial file (practically, a placeholder)

var audiofolder='audio_tmp/';

exec('mkdir -p '+audiofolder,function (error, stdout, stderr){;});
exec('mkdir -p /var/www/html/discord_logs/audios/',function (error, stdout, stderr){;});

function getNowUtc(){
	v=new Date();
	return v.getTime()/1000;
}

function randomIntInc (low, high) {//http://blog.tompawlak.org/generate-random-values-nodejs-javascript
    return Math.floor(Math.random() * (high - low + 1) + low);
}

function createTableTxt(){
	q='CREATE TABLE IF NOT EXISTS kiror_discordbot_text (\
	seq SERIAL PRIMARY KEY,\
	mde INT,\
	uid BIGINT,\
	tid BIGINT,\
	sid BIGINT,\
	mid BIGINT,\
	unm TEXT,\
	tnm TEXT,\
	snm TEXT,\
	msg TEXT,\
	att TEXT,\
	ts FLOAT\
	);';
	db.query(q, function(err, result) {
	if(err) {
		return console.error('Error in create table query: kiror_discordbot_text', err);
	}
	});
}

function createTableVoice(){
	q='CREATE TABLE IF NOT EXISTS kiror_discordbot_voice (\
	seq SERIAL PRIMARY KEY,\
	ts FLOAT,\
	name TEXT,\
	uid BIGINT,\
	ssrc INT,\
	pts FLOAT,\
	pseq BIGINT\
	);';
	//(ts,name,uid,bytes,ssrc,pts,pseq)
	db.query(q, function(err, result) {
	if(err) {
		return console.error('Error in create table query: kiror_discordbot_voice', err);
	}
	});
}

var distractions=true;

var db = new pg.Client(conString);
db.connect(function(err) {
	if(err) {
		setInterval(process.exit, 2000);
		return console.error('could not connect to postgres', err);
	}
	db.query('SELECT NOW() AS "theTime"', function(err, result) {
		if(err) {
			setInterval(process.exit, 2000);
			return console.error('error running query', err);
		}
		console.log(result.rows[0].theTime);
		//output: Fri Jan 22 2016 15:45:52 GMT-0200 (BRST)
	});
	createTableTxt();
	createTableVoice();
});

function storeTxtMsg(mode,uid,unm,sid,snm,tid,tnm,mid,msg,att){
	createTableTxt();
	now = getNowUtc();
	//console.log(now);
	q='INSERT INTO kiror_discordbot_text (mde,uid,tid,sid,unm,tnm,snm,mid,msg,att,ts) VALUES\
	(($1)::int, ($2)::bigint, ($3)::bigint, ($4)::bigint, ($5)::text, ($6)::text, ($7)::text,\
	 ($8)::bigint, ($9)::text, ($10)::text, ($11)::float);';
	arr=[mode,uid,tid,sid,unm,tnm,snm,mid,msg,JSON.stringify(att),now];
	//JSON.stringify
	//   dual
	//JSON.parse
	db.query(q,arr,function(err, result) {
	if(err) {
		return console.error('Error while inserting in table: kiror_discordbot_text', err);
	}
	});
}

function storeVoiceMsg(ts,name,uid,ssrc,pts,pseq){
	createTableVoice();
	now = getNowUtc();
	//console.log(now);
	q='INSERT INTO kiror_discordbot_voice (ts,name,uid,ssrc,pts,pseq) VALUES\
	(($1)::float, ($2)::text, ($3)::bigint, ($4)::int, ($5)::float, ($6)::bigint);';
	arr=[ts,name,uid,ssrc,pts,pseq];
	//JSON.stringify
	//   dual
	//JSON.parse
	db.query(q,arr,function(err, result) {
	if(err) {
		return console.error('Error while inserting in table: kiror_discordbot_voice', err);
	}
	});
}

function discordLogin(){
	client.connect({
	  email: discordusr,
	  password: discordpss
	});
}


client.Dispatcher.on(Events.GATEWAY_READY, e => {
  console.log(client.User.username + ' ('+client.User.id+')');
});

function isInArray(haystack,needle) {
  return haystack.indexOf(needle) > -1;
}

function stringStartsWith (string, prefix) {
    return string.slice(0, prefix.length) == prefix;
}

iplookupurl='http://www.meuip.com.br/index.php';

var voiceconn = undefined;

var hoster = false;

discordLogin();

client.Dispatcher.on(Events.DISCONNECTED, e => {
	setInterval(discordLogin, 5000);
});

client.Dispatcher.on(Discordie.Events.VOICE_CONNECTED, (e) => {
	e.voiceConnection.getDecoder()
	.onPacketDecoded = (packet) => {
		const user = e.voiceConnection.ssrcToMember(packet.ssrc);
		if (!user) return;
		
		var ts = getNowUtc();
		var name = user ? user.username : null;
		var uid = user ? user.id : null;
		var bytes = packet.chunk;
		var ssrc = packet.ssrc;
		var pts = packet.timestamp/100000;
		var pseq = packet.seq;
		//(ts,name,uid,bytes,ssrc,pts,pseq)
		
		//console.log(e);
		//console.log(packet)
		
		afn=(uid+'_'+pseq+'.s16le');
		fs.writeFile(audiofolder+afn,bytes,function(err){
			if(err) {
				return console.log('Error writing file... '+err);
			}else{
				cmd='ln -s '+cpath+'/'+audiofolder+afn+'  /var/www/html/discord_logs/audios/'+afn;
				exec(cmd,function (error, stdout, stderr){
					//console.log([error,stdout,stderr])
					;});
				storeVoiceMsg(ts,name,uid,ssrc,pts,pseq);
			}
		});
		
	}
});

client.Dispatcher.on(Events.MESSAGE_DELETE, e => {
	//(mode,uid,unm,sid,snm,tid,tnm,mid,msg,att)
	try{mid_md=(e.messageId);}catch(err){mid_md=null};
	try{cnt_md=(e.message.content);}catch(err){cnt_md=null};
	try{att_md=(e.message.attachments);}catch(err){att_md=null};
	try{uid_md=(e.message.author.id);}catch(err){uid_md=null};
	try{unm_md=(e.message.author.username);}catch(err){unm_md=null};
	try{cid_md=(e.channelId);}catch(err){cid_md=null};
	try{cnm_md=(e.message.channel.name);}catch(err){cnm_md=null};
	try{sid_md=(e.message.channel.guild.id);}catch(err){sid_md=null};
	try{snm_md=(e.message.channel.guild.name);}catch(err){snm_md=null};
	//(2,uid_md,unm_md,sid_md,snm_md,cid_md,cnm_md,mid_md,cnt_md,att_md)
	storeTxtMsg(2,uid_md,unm_md,sid_md,snm_md,cid_md,cnm_md,mid_md,cnt_md,att_md);
}
);

client.Dispatcher.on(Events.MESSAGE_UPDATE, e => {
	{
		//(mode,uid,unm,sid,snm,tid,tnm,mid,msg,att)
		mid_mu=(e.message.id);
		cnt_mu=(e.message.content);
		att_mu=(e.message.attachments);
		uid_mu=(e.message.author.id);
		unm_mu=(e.message.author.username);
		cid_mu=(e.message.channel.id);
		cnm_mu=(e.message.channel.name);
		sid_mu=(e.message.channel.guild.id);
		snm_mu=(e.message.channel.guild.name);
		//(1,uid_mu,unm_mu,sid_mu,snm_mu,cid_mu,cnm_mu,mid_mu,cnt_mu,att_mu)
		storeTxtMsg(1,uid_mu,unm_mu,sid_mu,snm_mu,cid_mu,cnm_mu,mid_mu,cnt_mu,att_mu);
	}
});

client.Dispatcher.on(Events.MESSAGE_CREATE, e => {
	if (!e.message.channel.is_private){
		//(mode,uid,unm,sid,snm,tid,tnm,mid,msg,att)
		mid_mc=(e.message.id);
		cnt_mc=(e.message.content);
		att_mc=(e.message.attachments);
		uid_mc=(e.message.author.id);
		unm_mc=(e.message.author.username);
		cid_mc=(e.message.channel.id);
		cnm_mc=(e.message.channel.name);
		sid_mc=(e.message.channel.guild.id);
		snm_mc=(e.message.channel.guild.name);
		//(0,uid_mc,unm_mc,sid_mc,snm_mc,cid_mc,cnm_mc,mid_mc,cnt_mc,att_mc)
		storeTxtMsg(0,uid_mc,unm_mc,sid_mc,snm_mc,cid_mc,cnm_mc,mid_mc,cnt_mc,att_mc);
	}
	if(e.message.author.id==client.User.id){;}
	else if (e.message.channel.is_private){if(randomIntInc(1,3)==3){return;}else{e.message.channel.sendMessage('Nothing to talk with you.');}}
	else if (stringStartsWith(e.message.content,'<@'+client.User.id+'>')){
		distractionsallowed = (distractions || isInArray(masters,e.message.author.id));
		hoster=(absolutemaster==e.message.author.id);
		function replyBack(msg){
			e.message.channel.sendMessage(msg);
		};
		var command = (e.message.content).slice(((('<@'+client.User.id+'>').length)+1));
		if (distractionsallowed && command=='help'){
			replyBack('HELP TEXT:\n\
`@'+client.User.username+' help`: You get this text.\n\
`@'+client.User.username+' version`: I show you my version.\n\
`@'+client.User.username+' suicide`: I close myself.\n\
`@'+client.User.username+' amnesia`: I forget everything.\n\
`@'+client.User.username+' ip`: You get some ways to connect to me.\n\
`@'+client.User.username+' list music`: I say randomly 20 musics I have.\n\
`@'+client.User.username+' list voice`: I say all voice channels I\'m seeing.\n\
`@'+client.User.username+' join voice XXXX`: I join the voice channel you asked.\n\
`@'+client.User.username+' leave voice XXXX`: I leave the voice channel you asked.\n\
`@'+client.User.username+' disk status`: You see how much space left I have in disk.\n\
`@'+client.User.username+' download`: You get a download link for downloading the logs I have.\n\
`@'+client.User.username+' play XXXX`: I play the audio file in the voice channel I am.\n\
`@'+client.User.username+' stop`: I stop the music.\n\
`@'+client.User.username+' record`: I\'m already doing it.\n\
`@'+client.User.username+' distractions`: It\'s a switch.\n\
`@'+client.User.username+' easteregg`: Does nothing.');return;
		}
		else if (distractionsallowed && command=='easteregg'){
			replyBack('HELP TEXT -- PUBLIC FUNCTIONALITIES -- PAGE 2:\n\
`@'+client.User.username+' help`: Returns to fist page.\n\
`@'+client.User.username+' supercow`: An advice.\n\
`@'+client.User.username+' roll dXX`: Rolls a dice with `XX` faces.\n\
			');return;
		}
		else if (distractionsallowed && command=='supercow'){
			replyBack('```SH\n\
s\n\
u                  (__) \n\
p                  (oo) \n\
e            /------\\/ \n\
r           / |    ||   \n\
c          *  /\\---/\\ \n\
o             ~~   ~~   \n\
w ..."Have you mooed today?"...```');return;
		}
		else if (distractionsallowed && stringStartsWith(command,'roll d')){
			dice=command.substring(6);
			di=parseInt(dice);
			if (dice=='k'){
				di=1000;
			}
			if (dice=='m'){
				di=1000000;
			}
			if (di==null || di==undefined || di<=1){
				replyBack('I don\'t know a dice with "'+dice+'" faces.');
			}
			res=randomIntInc(1,di);
			replyBack('d'+di+'... '+res+'!');
			return;
		}
		////////////////////NORMAL USERS BARRIER////////////////////////
		else if (!isInArray(masters,e.message.author.id)){
			if (distractions){
				replyBack("<@"+e.message.author.id+"> You're not my master!");
			}
			return;
		}
		else if (command=='distractions'){
			distractions=!distractions;
			replyBack('Now, distractions are '+{true:'on',false:'off'}[distractions]+'.');
		}
		else if (command=='version'){
			replyBack('kiror\'s bot  v.'+botver+"\n"+'NodeJS running on `'+os.hostname()+'`.');
		}
		else if (command=='ip'){
			request(iplookupurl, function (error, response, body) {
				if (!error && response.statusCode == 200) {
					ip=body.split('Meu IP:')[1].split('</div>')[0].split('>');
					ip=ip[ip.length-1].trim();
					replyBack(ip+"\nhttp://"+ip+':'+httpport+'/'+"\n```SH\nssh kiror@"+ip+" -p "+sshport+"```");
				}
				else {replyBack('Some error happened...');}
			})
		}
		else if (command=='suicide'){
			replyBack('Okay, so...');
			if(!hoster){
				replyBack('Wait... you can\'t revive me. Better not.');
				return;
			}
			db.end();
			client.disconnect();
			setInterval(process.exit, 2000);
			return;
		}
		else if (command=='amnesia'){
			if(!hoster){
				replyBack('Wait... you\'re not the one who is running me. Better not.');
				return;
			}
			cmd='rm -rf /var/www/html/discord_logs/; rm -rf '+audiofolder+' ; rm *.json; rm *.lzma; psql -c"drop table kiror_discordbot_text;drop table kiror_discordbot_voice;"';
			exec(cmd,function (error, stdout, stderr){
				exec('mkdir -p '+audiofolder,function (error, stdout, stderr){;});
				exec('mkdir -p /var/www/html/discord_logs/audios/',function (error, stdout, stderr){;});
				replyBack('Who am I?');
			});
			return;
		}
		else if (command=='list voice'){
			var ch2 = e.message.channel.guild.voiceChannels;
			var ch = {};
			for(var k in ch2){
				if(ch2[k].type=='voice'){
					ch[ch2[k].name]=[ch2[k].id,ch2[k]];
				}
			}
			var s = "\n";
			for(var k in ch){
				s+="`"+ch[k][0]+"` = <#"+ch[k][0]+"> (`"+k+"`)\n";
			}
			replyBack(s);
		}
		else if (stringStartsWith(command,'join voice ')){
			var k = command.substring(11);
			var ch2 = e.message.channel.guild.voiceChannels;
			var ch = {};
			for(var j in ch2){
				if(ch2[j].type=='voice'){
					ch[ch2[j].name]=[ch2[j].id,ch2[j]];
				}
			}
			var vcid = ch[k];
			if(vcid==undefined){
				replyBack('I don\'t know what voice channel is `'+k+'`.');
			}else{
				vcid=vcid[1];
				replyBack('Joining...');
				if(vcid.joined){vcid.leave();};
				vcid.join()//.then(v => play(v));
				voiceconn=vcid;
			}
		}
		else if (stringStartsWith(command,'leave voice ')){
			voiceconn=undefined;
			var k = command.substring(12);
			var ch2 = e.message.channel.guild.voiceChannels;
			var ch = {};
			for(var j in ch2){
				if(ch2[j].type=='voice'){
					ch[ch2[j].name]=[ch2[j].id,ch2[j]];
				}
			}
			var vcid = ch[k];
			if(vcid==undefined){
				replyBack('I don\'t know what voice channel is `'+k+'`.');
			}else{
				vcid=vcid[1];
				replyBack('Leaving...');
				if(vcid.joined){vcid.leave();};
			}
		}
		else if (stringStartsWith(command,'play ')){
			if (voiceconn==undefined) {replyBack('Not connected to a voice channel.');return;}
			var k = command.substring(5);
			if(fs.lstatSync('/home'+unixuserfoldername+'Music/'+k).isFile()){
				musicfile = '/home'+unixuserfoldername+'Music/'+k;
				play();
			}
			else{replyBack('File not found.')}
		}
		else if (stringStartsWith(command,'stop')){
			if (voiceconn==undefined) {replyBack('Not connected to a voice channel.');return;}
			stop();
			replyBack('If I was playing an audio before, I stopped now.');
		}
		else if (stringStartsWith(command,'record')){
			if (voiceconn==undefined) {replyBack('Not connected to a voice channel.');return;}
			stop();
			replyBack('I am always recording every place I visit.');
		}
		else if (command == 'disk status'){
			term="df | grep -e ' /$' | awk '{print \"Free space: \" $4/1024 \"MiB \\nDisk usage: \" $5 \" full.\"}'";
			exec(term,function (error, stdout, stderr){
				replyBack(stdout);
			});
		}
		else if (stringStartsWith(command,'download')){
			fnn='discord_log_'+Math.floor(getNowUtc());
			fname=fnn+'.json';
			db.query('SELECT * FROM kiror_discordbot_text',function(err, resulttxt) {
				db.query('SELECT * FROM kiror_discordbot_voice',function(err, resultvc) {
					fcont=JSON.stringify({'text':resulttxt, 'voice':resultvc});
					fs.writeFile(fname, fcont, function(err) {
						if(err) {
							replyBack('Error while writing file... something is not okay.');
							return;
						}
					});
					term1='j="$(pwd)"; mkdir -p /var/www/html/discord_logs/; ln -s $j/'+fname+' /var/www/html/discord_logs/'+fname;
					exec(term1,function (error, stdout, stderr){
					 term2='tar caf '+fnn+'.tar.lzma '+fname+' '+audiofolder;
					 exec(term2,function (error, stdout, stderr){
					  term3='j="$(pwd)"; ln -s $j/'+fnn+'.tar.lzma'+' /var/www/html/discord_logs/'+fnn+'.tar.lzma';
					  exec(term3,function (error, stdout, stderr){
					  ;});
					 ;});
					;});
					request(iplookupurl, function (error, response, body) {
					if (!error && response.statusCode == 200) {
						ip=body.split('Meu IP:')[1].split('</div>')[0].split('>');
						ip=ip[ip.length-1].trim();
						replyBack("Download link: http://"+ip+':'+httpport+'/discord_logs/'+fnn+'.tar.lzma'+"\n"+
							"Or visit http://"+ip+':'+httpport+'/discord_logs/ to see all previous undeleted logs.');
					}
					else {replyBack('Some error happened...');}
					})
				});
			});
		}
		else if (stringStartsWith(command,'list music')){
			fs.readdir('/home'+unixuserfoldername+'Music', function (err, files){
				pick=20;
				arr=[];
				while(pick>0){
					rd=randomIntInc(0,files.length-1);
					arr.push(rd);
					pick-=1;
				}
				s='';
				for (var mus in arr){
					s+='No. '+arr[mus]+': `@'+client.User.username+' play '+files[arr[mus]]+'`\n';
				}
				s+='You can repeat this command to see more musics (randomly).'
				replyBack(s);
			});
		}
		else {
			replyBack('I don\'t know what you want... try `help`.');
		}
	}
});

////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////_FOR_MUSIC_PLAYING_/////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////
/// Copy-paste from https://github.com/qeled/discordie/blob/master/examples/massive2.js ////////////
////////////////////////////////////////////////////////////////////////////////////////////////////

function getConverter(args, options) {
	var binaries = [
		'ffmpeg',
		'ffmpeg.exe',
		'avconv',
		'avconv.exe'
	];

	var paths = process.env.PATH.split(path.delimiter).concat(["."]);

	for (var name of binaries) {
		for (var p of paths) {
			var binary = p + path.sep + name;
			if (!fs.existsSync(binary)) continue;
			return child_process.spawn(name, args, options);
		}
	}
	return null;
}

var ffmpeg = null;
function stop() {
	stopPlaying = true;
	if (!ffmpeg) return;
	ffmpeg.kill();
	ffmpeg = null;
}

var stopPlaying = false;
function play(voiceConnectionInfo) {
	stopPlaying = false;

	var sampleRate = 48000;
	var bitDepth = 16;
	var channels = 1;

	if (ffmpeg) ffmpeg.kill();

	ffmpeg = getConverter([
		"-re",
		"-i", musicfile,
		"-f", "s16le",
		"-ar", sampleRate,
		"-ac", channels,
		"-"
	], {stdio: ['pipe', 'pipe', 'ignore']});
	if (!ffmpeg) return console.log("ffmpeg/avconv not found");

	var _ffmpeg = ffmpeg;
	var ff = ffmpeg.stdout;

	// note: discordie encoder does resampling if rate != 48000
	var options = {
		frameDuration: 60,
		sampleRate: sampleRate,
		channels: channels,
		float: false,

		multiThreadedVoice: true
	};

	const frameDuration = 60;

	var readSize =
		sampleRate / 1000 *
		options.frameDuration *
		bitDepth / 8 *
		channels;

	ff.once('readable', function() {
		if(!client.VoiceConnections.length) {
			return console.log("Voice not connected");
		}
        
		if(!voiceConnectionInfo) {
			// get first if not specified
			voiceConnectionInfo = client.VoiceConnections[0];
		}
		var voiceConnection = voiceConnectionInfo.voiceConnection;
        
		// one encoder per voice connection
		var encoder = voiceConnection.getEncoder(options);

		const needBuffer = () => encoder.onNeedBuffer();
		encoder.onNeedBuffer = function() {
			var chunk = ff.read(readSize);

			if (_ffmpeg.killed) return;
			if (stopPlaying) return stop();

			// delay the packet if no data buffered
			if (!chunk) return setTimeout(needBuffer, options.frameDuration);

			var sampleCount = readSize / channels / (bitDepth / 8);
			encoder.enqueue(chunk, sampleCount);
		};

		needBuffer();
	});

	ff.once('end', () => {
		if (stopPlaying) return;
		setTimeout(play, 100, voiceConnectionInfo);
	});
}


