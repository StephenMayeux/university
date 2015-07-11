
var Code = require('code');
var Lab = require('lab');
var University = require('../../lib');
var Path = require('path');
var Config = require('../../lib/config');
var Cheerio = require('cheerio');
var GenerateCrumb = require('../crumb');
var Crumb = require('crumb');

// Declare internals

var internals = {};


// Test shortcuts

var lab = exports.lab = Lab.script();
var describe = lab.experiment;
var expect = Code.expect;
var it = lab.test;



describe('/login', function () {

    it('GET request access login page', function (done) {

        University.init(internals.manifest, internals.composeOptions, function (err, server) {

            //
            //  Begin to implement nock here.
            //  crumb requires https so http request fail.
            //

            var request1 = { method: 'GET', url: '/login' };

            server.select('web-tls').inject(request1, function (res) {

                expect(res.statusCode, 'Status code').to.equal(200);
                server.stop(done);
            });
        });
    });

    it('CRUMB -- POST successful login', function (done) {

        University.init(internals.manifest, internals.composeOptions, function (err, server) {


            /*
             * @todo Build this out
             * helpful links
             * https://github.com/npm/newww/blob/2bc02c7558c7a3b8bdb34858ff99cd77d7c7c06a/test/handlers/crumb.js
             * https://github.com/npm/newww/blob/2bc02c7558c7a3b8bdb34858ff99cd77d7c7c06a/test/handlers/user/login.js
             * https://github.com/npm/newww/blob/master/routes/public.js
             */
            GenerateCrumb(server, function (crumb) {

                var options = {
                    url: '/login',
                    method: 'POST',
                    payload: {
                        username: 'foo',
                        password: 'foo',
                        crumb: crumb
                    },
                    headers: { cookie: 'crumb=' + crumb }
                };
                // var target = options.headers.cookie.replace('crumb=', '')
                // var target = options.headers.cookie.replace('crumb=', '');
                // var target = options.headers.cookie.replace('crumb=', '');
                //expect(options).to.equal('Foo Foo');

                expect(options.headers.cookie).to.equal('crumb=' + crumb);

                server.select('api').inject(options, function (res) {

                    expect(res.statusCode).to.equal(200);
                    // expect(resp.headers.location).to.equal('/~bob');
                    done();
                });
            });

        });

    });

    it('no CRUMB POST login attempt fails', function (done) {

        University.init(internals.manifest, internals.composeOptions, function (err, server) {

            expect(err).to.not.exist();


            // Login Failure no CRUMB


            var request = { method: 'POST', url: '/login', payload: internals.loginCredentials('foo', 'foo') };

            internals.server = server;

            internals.server.select('api').inject(request, function (res) {

                // Forbiden
                expect(res.statusCode, 'Status code').to.equal(403);

                // var result = JSON.parse(res.result);
                expect(res.result.error).to.equal('Forbidden');
                expect(res.result.message).to.equal('What Are You Doing!!!');
                internals.server.stop(done);
            });

        });
    });

    it('CRUMB POST successfully login, access home page, and get redirect if logged in', function (done) {

        University.init(internals.manifest, internals.composeOptions, function (err, server) {

            expect(err).to.not.exist();

            internals.server = server;

            GenerateCrumb(internals.server, function (crumb){

                internals.crumb = crumb;

                internals.options = {
                    url: '/login',
                    method: 'POST',
                    payload: {
                        username: 'foo',
                        password: 'foo',
                        crumb: crumb
                    },
                    headers: { cookie: 'crumb=' + crumb }
                };

                expect(internals.options.headers.cookie).to.equal('crumb=' + crumb);


                // Successfull Login


                internals.server.select('api').inject(internals.options, function (res) {

                    expect(res.statusCode).to.equal(200);
                    expect(res.result.username).to.equal('Foo Foo');

                    // hapi-auth-cookie placed in headers -- get value.

                    var header = res.headers['set-cookie'];
                    expect(header.length).to.equal(1);
                    expect(header[0]).to.contain('Max-Age=60');

                    internals.authcookie = header[0].match(/(?:[^\x00-\x20\(\)<>@\,;\:\\"\/\[\]\?\=\{\}\x7F]+)\s*=\s*(?:([^\x00-\x20\"\,\;\\\x7F]*))/);

                    internals.options.url = '/home';
                    internals.options.method = 'GET';
                    delete internals.options.payload;
                    internals.options.headers.cookie = 'hapi-university=' + internals.authcookie[1];

                    expect(internals.options.method).to.equal('GET');


                    // Successfully access homepage as authenticated user.

                    internals.server.select('web-tls').inject(internals.options, function (res) {

                        expect(res.statusCode).to.equal(200);
                        var $ = Cheerio.load(res.result);
                        var result = ($('h1', 'body').text());
                        expect(result).to.equal('Foo Foo');

                        var newcrumb = res.headers['set-cookie'][0].split('; ')[0].replace('crumb=', '');
                        expect(newcrumb).to.not.equal(internals.crumb);


                        // Already authenticated user visits /login route and gets redirected.
                        var request3 = { method: 'GET', url: '/login', headers: { cookie: 'hapi-university=' + internals.authcookie[1] } };

                        internals.server.select('web-tls').inject(request3, function (res) {

                            expect(res.statusCode, 'Status code').to.equal(302);  // redirected
                            expect(res.headers.location).to.include('/account');
                            internals.server.stop(done);
                        });
                    });
                });
            });
        });
    });

    it('POST logged in user gets redirected', function (done) {

        University.init(internals.manifest, internals.composeOptions, function (err, server) {

            expect(err).to.not.exist();


            // Successfull Login

            GenerateCrumb(internals.server, function (crumb){

                internals.crumb = crumb;

                internals.options = {
                    url: '/login',
                    method: 'POST',
                    payload: {
                        username: 'foo',
                        password: 'foo',
                        crumb: crumb
                    },
                    headers: { cookie: 'crumb=' + crumb }
                };

                expect(internals.options.headers.cookie).to.equal('crumb=' + crumb);

                internals.server = server;

                internals.server.select('api').inject(internals.options, function (res) {

                    expect(res.statusCode, 'Status code').to.equal(200);
                    expect(res.result.username).to.equal('Foo Foo');



                    // ./home greets authenticated user


                    var header = res.headers['set-cookie'];
                    expect(header.length).to.equal(1);
                    expect(header[0]).to.contain('Max-Age=60');

                    internals.cookie = header[0].match(/(?:[^\x00-\x20\(\)<>@\,;\:\\"\/\[\]\?\=\{\}\x7F]+)\s*=\s*(?:([^\x00-\x20\"\,\;\\\x7F]*))/);

                    var request2 = { method: 'GET', url: '/home', headers: { cookie: 'hapi-university=' + internals.cookie[1] } };

                    internals.server.select('web-tls').inject(request2, function (res) {

                        var $ = Cheerio.load(res.result);
                        var result = ($('h1', 'body').text());

                        expect(result).to.equal('Foo Foo');


                        // ./login GET redirects previously authenticated user to /account route.


                        var request3 = { method: 'GET', url: '/login', headers: { cookie: 'hapi-university=' + internals.cookie[1] } };

                        internals.server.select('web-tls').inject(request3, function (res) {

                            expect(res.statusCode, 'Status code').to.equal(302);  // redirected
                            expect(res.headers.location).to.include('/account');

                            internals.server.stop(done);
                        });
                    });
                });
            });
        });
    });


    // @todo  split below into tests


    it('Login Failures', function (done) {

        University.init(internals.manifest, internals.composeOptions, function (err, server) {

            expect(err).to.not.exist();

            internals.server = server;

            GenerateCrumb(internals.server, function (crumb){

                internals.crumb = crumb;

                internals.options = {
                    url: '/login',
                    method: 'POST',
                    payload: {
                        username: '',
                        password: 'fail',
                        crumb: crumb
                    },
                    headers: { cookie: 'crumb=' + crumb }
                };

                expect(internals.options.headers.cookie).to.equal('crumb=' + crumb);


                // No username submitted attempt


                internals.server.select('api').inject(internals.options, function (res) {

                    expect(res.statusCode, 'Status code').to.equal(400);
                    expect(res.result.message).to.equal('Malformed Data Entered');
                });


                // No password submitted attempt

                internals.options.payload.username = 'test';
                internals.options.payload.password = '';

                // var request1 = { method: 'POST', url: '/login', payload: internals.loginCredentials('test', '') };

                internals.server.select('api').inject(internals.options, function (res) {

                    expect(res.statusCode, 'Status code').to.equal(400);                // joi validation produces this error
                    expect(res.result.message).to.equal('Malformed Data Entered');      // lib/index.js logic customizes error message.
                });


                // Non-existing user attempt

                internals.options.payload.username = 'foo';
                internals.options.payload.password = 'bamo';

                internals.server.select('api').inject(internals.options, function (res) {

                    expect(res.statusCode, 'Status code').to.equal(401);                 // lib/api/login.js POST ./login issue Boom error.
                    expect(res.result.message).to.equal('Invalid password or username'); // message set in Boom.unauthorized(message)
                    // internals.server.stop(done);
                });

                // User exists but crumb fails

                internals.options.payload.username = 'foo';
                internals.options.payload.password = 'foo';
                delete internals.options.headers.cookie;

                internals.server.select('api').inject(internals.options, function (res) {

                    expect(res.statusCode, 'Status code').to.equal(403);                 // lib/api/login.js POST ./login issue Boom error.
                    expect(res.result.message).to.equal('What Are You Doing!!!'); // message set in Boom.unauthorized(message)
                    internals.server.stop(done);
                });
            });
        });
    });

    it('Bad Routes and Auth Failure', function (done) {

        University.init(internals.manifest, internals.composeOptions, function (err, server) {

            expect(err).to.not.exist();

            //internals.server = server;

            GenerateCrumb(server, function (crumb){

                internals.crumb = crumb;

                internals.options = {
                    url: '/wakawa',
                    method: 'POST',
                    payload: {
                        username: 'foo',
                        password: 'foo',
                        crumb: crumb
                    },
                    headers: { cookie: 'crumb=' + crumb }
                };

                expect(internals.options.headers.cookie).to.equal('crumb=' + crumb);


                // Non-existing user attempt and bad route


                server.select('api').inject(internals.options, function (res) {

                    expect(res.statusCode, 'Status code').to.equal(301);
                    expect(res.headers.location).to.equal('https://localhost:8001/home');
                });


                // Non-existing user attempt.

                internals.options.url = '/login';
                internals.options.payload.username = 'boot';
                internals.options.payload.password = 'toot';

                server.select('api').inject(internals.options, function (res) {

                    expect(res.statusCode, 'Status code').to.equal(401);
                    expect(res.result.message).to.equal('Invalid password or username');
                    server.stop(done);
                });
            });
        });
    });
});

describe('/logout', function () {

    it('Ensure logout works', function (done) {

        University.init(internals.manifest, internals.composeOptions, function (err, server) {

            expect(err).to.not.exist();


            // Successfull Login


            GenerateCrumb(server, function (crumb){

                internals.crumb = crumb;

                internals.options = {
                    url: '/login',
                    method: 'POST',
                    payload: {
                        username: 'foo',
                        password: 'foo',
                        crumb: crumb
                    },
                    headers: { cookie: 'crumb=' + crumb }
                };

                // expect(internals.options.headers[0]).to.equal('crumb=' + crumb);


                var tlserver = server.select('web-tls');

                tlserver.inject(internals.options, function (res) {

                    expect(res.statusCode, 'Status code').to.equal(200);
                    expect(res.result.username).to.equal('Foo Foo');

                    var header = res.headers['set-cookie'];

                    expect(header.length).to.equal(1);
                    expect(header[0]).to.contain('Max-Age=60');

                    var cookie = header[0].match(/(?:[^\x00-\x20\(\)<>@\,;\:\\"\/\[\]\?\=\{\}\x7F]+)\s*=\s*(?:([^\x00-\x20\"\,\;\\\x7F]*))/);


                    // ./logout authenticated user logout returns success message


                    // Hack
                    //internals.options.url = '/logoutb';
                    // internals.options.method = 'GET';
                    internals.options.url = '/logout';
                    internals.options.method = 'POST';
                    delete internals.options.payload.username;
                    delete internals.options.payload.password;
                    internals.options.headers.cookie = 'hapi-university=' + cookie[1];
                    // internals.options.headers = {
                    //     cookie: internals.options.headers.cookie = 'hapi-university=' + cookie[1]
                    // };

                    var request2 = { method: 'GET', url: '/logout', headers: { cookie: 'hapi-university=' + cookie[1] } };

                    tlserver.inject(internals.options, function (res) {

                        //
                        // @todo this is failing.
                        // Need to write fixes to cancel crumb at logout out.
                        // skip is the function to use. !!
                        // request.headers or info or path or url.
                        //

                        // redirects to login because needs auth set too
                        // expect(res.headers.location).to.include('/login');
                        expect(res.statusCode).to.equal(200);
                        server.stop(done);
                    });
                });
            });
        });
    });

    it('Unregistered user tried to access restricted ./logout on api', function (done) {

        University.init(internals.manifest, internals.composeOptions, function (err, server) {

            expect(err).to.not.exist();

            var request = { method: 'POST', url: '/logout' };

            internals.server.select('api').inject(request, function (res) {


                //  Unauthenticated user redirected to login page.


                expect(res.statusCode, 'Status code').to.equal(302);
                expect(res.headers.location).to.equal('/login');
                server.stop(done);
            });
        });
    });

    it('crumb registration failed', { parallel: false }, function (done) {

        var orig = Crumb.register;

        Crumb.register = function (plugin, options, next) {

            Crumb.register = orig;
            return next(new Error('fail'));
        };

        Crumb.register.attributes = {
            name: 'fake crummy'
        };

        University.init(internals.manifest, internals.composeOptions, function (err) {

            expect(err).to.exist();
            done();
        });
    });

});

internals.manifest = {
    connections: [
        {
            host: 'localhost',
            port: 0,
            labels: ['web']
        },
        {
            host: 'localhost',
            port: 0,
            labels: ['web-tls', 'api'],
            tls: Config.tls
        }
    ],
    plugins: {
        './home': [{
            'select': ['web', 'web-tls']
        }],
        './api/login': [{
            'select': ['api']
        }],
        './auth-cookie': {},
        'hapi-auth-cookie': {},
        './crummy': {}
    }
};

internals.composeOptions = {
    relativeTo: Path.resolve(__dirname, '../../lib')
};

internals.loginCredentials = function (username, password) {

    return JSON.stringify({ username: username, password: password });
};

