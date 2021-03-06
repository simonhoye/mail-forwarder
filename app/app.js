'use strict';

var async = require('async');
var express = require('express');
var fs = require('fs');
var multiparty = require('multiparty');
var util = require('util');

var nodemailer = require('nodemailer');


/* Make an http server to receive the webhook. */
var server = express();

var validUsers = [
    {
        name: 'Simon',
        beardedEmail: 'simon@beardedmail.com',
        realEmail: 'simonhoye@gmail.com'
    },
    {
        name: 'Brad',
        beardedEmail: 'brad@beardedmail.com',
        realEmail: 'bradmclean@gmail.com '
    }
]


server.head('/webhook', function (req, res) {
    console.log('Received head request from webhook.');
    res.sendStatus(200);
});

server.post('/webhook', function (req, res) {
    console.log('Receiving webhook.');

    /* Respond early to avoid timouting the mailin server. */
    // res.send(200);

    /* Parse the multipart form. The attachments are parsed into fields and can
     * be huge, so set the maxFieldsSize accordingly. */
    var form = new multiparty.Form({
        maxFieldsSize: 70000000
    });

    form.on('progress', function () {
        var start = Date.now();
        var lastDisplayedPercentage = -1;
        return function (bytesReceived, bytesExpected) {
            var elapsed = Date.now() - start;
            var percentage = Math.floor(bytesReceived / bytesExpected * 100);
            if (percentage % 20 === 0 && percentage !== lastDisplayedPercentage) {
                lastDisplayedPercentage = percentage;
                console.log('Form upload progress ' +
                    percentage + '% of ' + bytesExpected / 1000000 + 'Mb. ' + elapsed + 'ms');
            }
        };
    }());

    form.parse(req, function (err, fields) {

        console.log(util.inspect(fields.mailinMsg, {
            depth: 5
        }));


        console.log('Parsed fields: ' + Object.keys(fields));

        /* Write down the payload for ulterior inspection. */
        async.auto({

            writeParsedMessage: function (cbAuto) {
                fs.writeFile('payload.json', fields.mailinMsg, cbAuto);
            },
            writeAttachments: function (cbAuto) {
                var msg = JSON.parse(fields.mailinMsg);
                async.eachLimit(msg.attachments, 3, function (attachment, cbEach) {
                    fs.writeFile(attachment.generatedFileName, fields[attachment.generatedFileName], 'base64', cbEach);
                }, cbAuto);
            },
            sendEmail: function(cbAuto) {
                var msg = JSON.parse(fields.mailinMsg);
                for(var i=0; i <= validUsers.length -1; i++) {
                    if(validUsers[i].beardedEmail == msg.to[0].address) {
                        var nodemailer = require('nodemailer');
                        var transporter = nodemailer.createTransport();
                        transporter.sendMail({
                            from: 'BeardedMail <no-reply@beardedmail.com>',
                            to: validUsers[i].realEmail,
                            subject: 'Hey '+validUsers[i].name+'! You have BeardedMail from <'+msg.from[0].address + ">",
                            text: msg.subject,
                            html: msg.html
                        });
                    }

                }
            }
        }, function (err,fields) {
            if (err) {
                console.log(err.stack);
                res.sendStatus(500, 'Unable to write payload');
            } else {
                console.log('Webhook payload written.');
                res.sendStatus(200);



            }
        });
    });
});

server.listen(3000, function (err) {
    if (err) {
        console.log(err);
    } else {
        console.log('Http server listening on port 3000');
    }
});