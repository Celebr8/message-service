const restify = require('restify');
const dotenv = require('dotenv');
const mailgun = require('mailgun-js');

dotenv.config()

const mailgunApiKey = process.env.MAILGUN_API_KEY;
const mailgunDomainName = process.env.MAILGUN_DOMAIN_NAME;
const serviceDestinationEmail = process.env.SERVICE_DESTINATION_EMAIL;

if(!mailgunApiKey) throw Error('No Mailgun API key defined')
if(!mailgunDomainName) throw Error('No Mailgun domain name defined')

if(!serviceDestinationEmail) throw Error('No service destination email')

const mg = mailgun({apiKey: mailgunApiKey, domain: mailgunDomainName});

const server = restify.createServer()

server.post('/message', (req, res, next) => {

	console.log('Validate the datas')
	console.log(req)

	// Validation
	
	const checkParams = (params, required) => 
		required.reduce((soFar, key) =>
			soFar && Object.keys(params).indexOf(key) != -1	
		)

	if(!checkParams(req.params, ['email', 'phoneNumber', 'message', 'subject'])) {
	
		if(!req.params.email) res.send(400, { status: 400, message: 'No email defined'})
		else if(!req.params.phoneNumber) res.send(400, { status: 400, message: 'No phone number defined'})
		else if(!req.params.message) res.send(400, { status: 400, message: 'No message defined'})
		else if(!req.params.subject) res.send(400, { status: 400, message: 'No subject defined'})

		return next();
	
	}

	const text = `

		Message recieved from whichost frontend

		Subject: ${req.params.subject}

		${req.params.message}

		Phone number: ${req.params.phoneNumber}
		Email address: ${req.params.email}

	`

	console.log(`Recieve a message from ${req.params.email}`)	


	var data = {
	  from: req.params.email,
	  to: serviceDestinationEmail,
	  subject: req.params.subject,
	  text: req.param.message
	};

	mailgun.messages().send(data, function (error, body) {
		
		if(!error) { 

			console.log('Send email')
			res.send(JSON.stringify({ status: 200, message: 'Send email'}))	
		
		}
		else {
			
			console.log('Fail to send email.')
			console.log(error)
			res.send(JSON.stringify({ status: 500, message: 'Failed to send email', error}))
		
		}

	});


})

server.listen(80, () => {
  console.log('%s listening at %s', server.name, server.url);
});
