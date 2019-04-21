// Import

const restify = require('restify');
const dotenv = require('dotenv');
const sendgrid = require('@sendgrid/mail');
const corsMiddleware = require('restify-cors-middleware');
const Recaptcha = require('recaptcha-verify');

// Environement

dotenv.config();

const port = process.env.PORT || 80;

const dev = process.env.NODE_ENV != 'production';

const sendgridApiKey = process.env.SENDGRID_API_KEY;
const serviceDestinationEmail = process.env.SERVICE_DESTINATION_EMAIL;
const recaptchaSecretKey = process.env.RECAPTCHA_SECRET_KEY;

if (!sendgridApiKey) throw Error('No Sendgrid API key defined');
if (!serviceDestinationEmail) throw Error('No service destination email');
if (!recaptchaSecretKey) throw Error('No reCaptcha secret key');

// Initialisation

const server = restify.createServer();

sendgrid.setApiKey(sendgridApiKey);

if (dev) console.log('Development mode');

const origins = dev ? ['*'] : ['http://www.whichost.com'];

const recaptcha = new Recaptcha({
  secret: recaptchaSecretKey,
  verbose: dev,
});

const cors = corsMiddleware({
  preflightMaxAge: 5, //Optional
  origins,
  allowHeaders: ['API-Token'],
  exposeHeaders: ['API-Token-Expiry'],
});

server.use(
  restify.plugins.bodyParser({
    mapParams: true,
  }),
);

server.pre(cors.preflight);
server.use(cors.actual);

async function validateRecaptcha(token) {
  return new Promise((resolve, reject) => {
    // reCaptcha validation

		recaptcha.checkResponse(token, (error, response) => {

			console.log('Recieved a response: ', response)

			if(error) reject(new Error(error));
			else resolve(response);	
		});
  });
}

server.post('/message', async (req, res, next) => {
  const params = JSON.parse(req.body);

  // Validation

  const checkParams = (params, required) =>
    required.reduce(
      (soFar, key) => soFar && Object.keys(params).indexOf(key) != -1,
    );

  if (!checkParams(params, ['email', 'phoneNumber', 'message', 'subject', 'recaptchaToken'])) {
    if (!params.email)
      res.send(400, {status: 400, message: 'No email defined'});
    else if (!params.phoneNumber)
      res.send(400, {status: 400, message: 'No phone number defined'});
    else if (!params.message)
      res.send(400, {status: 400, message: 'No message defined'});
    else if (!params.subject)
      res.send(400, {status: 400, message: 'No subject defined'});
    else if (!params.recaptchaToken)
      res.send(400, {status: 400, message: 'No recaptcha Token defined'});

    return next();
  }

	// reCaptcha validation

	try {
		const recaptchaResponse = await validateRecaptcha(params.recaptchaToken);
		if(!recaptchaResponse.success) throw Error('You are a robot', recaptchaResponse)
	}
	catch(error) {
		console.log('reCaptcha validation failed', error)
		res.send(400, {status: 400, message: 'reCaptcha validation failed', error})	
		return next();
	}

  // Sending

  const text = `

		Message recieved from whichost frontend

		Subject: ${req.params.subject}

		${req.params.message}

		Phone number: ${req.params.phoneNumber}
		Email address: ${req.params.email}

	`;

  console.log(`Recieve a message from ${params.email}`);

  var data = {
    from: params.email,
    to: serviceDestinationEmail,
    subject: params.subject,
    text: params.message,
  };

  sendgrid
    .send(data)
    .then(() => {
      console.log('Send email');
      res.send(JSON.stringify({status: 200, message: 'Send email'}));
      next();
    })
    .catch(error => {
      console.log('Fail to send email.');
      console.log(error);

      res.send(500, 
        JSON.stringify({status: 500, message: 'Failed to send email', error}),
      );

      next();
    });
});

// Serve

server.listen(port, () => {
  console.log('%s listening at %s', server.name, server.url);
});
