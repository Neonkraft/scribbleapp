var mongojs = require("mongojs");
var express = require("express");
var bodyParser = require("body-parser");
var https = require("https");

var app = new express();
var db = mongojs('mongodb://themadhatter:scribblealice@ds035593.mongolab.com:35593/scribbledb', ['scribbledb']);

app.use(express.static(__dirname + "/public"));
app.use(bodyParser.json());

// used for authentication
var router = express.Router();

var userName = '';

router.use(function(req, res, next){

	if(!req.query.token){
		res.json({status : "Authentication token not provided!"});
		return;
	} 

	var options = {
		hostname : 'graph.facebook.com',
		path : '/v2.4/me?access_token='+req.query.token,
		method : 'GET'
	};

	var facebookRequest = https.request(options, function(response){
		var str = '';

		response.on('data', function(chunk){
			str += chunk;
		});

		response.on('end', function(){

			var fbResponse = JSON.parse(str);
			console.log("fb_name : " + fbResponse.name);

			if(fbResponse.name){
				db.scribbledb.find({facebook_id : fbResponse.id}, function(err, docs){
					console.log(err);

					// if the user is not already registered, then add user details to the db
					if(docs == ''){
						
						var user = {
							name : fbResponse.name,
							facebook_id : fbResponse.id,
						};

						req.facebook_id = fbResponse.id;
						db.scribbledb.insert(user, function(err, doc){
							console.log("New user added");
							userName = fbResponse.name;
							next();
						});
					} else {
						
						console.log("User already exists!");
						userName = fbResponse.name;

						req.facebook_id = fbResponse.id;
						next();
					}
				});
			} else {
				
				console.log("Authentication failed!");
				res.json({status : "auth fail"});
			}
		});
	});
	facebookRequest.end();
});

app.use("/", router);

app.get('/getAllPosts', function(req, res) {
	db.scribbledb.find(function (err, docs) {
		res.json(docs);
	});	
});

app.get('/getPost', function(req, res) {

	var lat = parseFloat(req.query.lat);
	var lng = parseFloat(req.query.lng);
	var radius = parseFloat(req.query.radius);

	db.runCommand({
		geoNear: "scribbledb",
     	near: { type: "Point", coordinates: [ lat, lng ] },
     	spherical: true,
     	maxDistance: radius
	}, 	function (err, doc) {
    		if(!err && doc.ok) {
    			console.log('we\'re up');
    			res.json(doc.results);	
			} else {
				console.log("Somethin wrong, doc!");
				res.json({status : "Query returned error!"});
			}
	});
});

app.get('/addPost', function(req, res){

	var name = userName;// req.query.name;
	var msg = req.query.msg;
	var lat = parseFloat(req.query.lat);
	var longitude = parseFloat(req.query.lng);	
	var facebook_id = req.facebook_id;

	var loc = { 
		type : "Point",
		coordinates : [ lat, longitude]
	};

	var insertObj = { 
		name : name,
		facebook_id : facebook_id,
		msg : msg,
		loc : loc
	}

	console.log("insert : " + insertObj);

	db.scribbledb.insert(insertObj, function (err, doc) {
		if(!err)
			{
				console.log("success!!");
				res.json(insertObj);
			}
			else {
				console.log("db result : " + doc);
			}
	});
});

app.listen(3000);
