const nock = require('nock');
const chai = require('chai');

const UserModel = require('plugins/sd-ct-oauth-plugin/models/user.model');
const UserTempModel = require('plugins/sd-ct-oauth-plugin/models/user-temp.model');
const { isEqual } = require('lodash');

const { setPluginSetting } = require('../utils/helpers');
const { getTestAgent, closeTestAgent } = require('./../test-server');

const should = chai.should();

let requester;

nock.disableNetConnect();
nock.enableNetConnect(process.env.HOST_IP);

describe('OAuth endpoints tests - Sign up with JSON content type', () => {

    before(async () => {
        if (process.env.NODE_ENV !== 'test') {
            throw Error(`Running the test suite with NODE_ENV ${process.env.NODE_ENV} may result in permanent data loss. Please use NODE_ENV=test.`);
        }

        // We need to force-start the server, to ensure mongo has plugin info we can manipulate in the next instruction
        await getTestAgent(true);

        await setPluginSetting('oauth', 'allowPublicRegistration', true);

        requester = await getTestAgent(true);

        UserModel.deleteMany({}).exec();
        UserTempModel.deleteMany({}).exec();


    });

    it('Registering a user without being logged in returns a 422 error - JSON version', async () => {
        const response = await requester
            .post(`/auth/sign-up`)
            .set('Content-Type', 'application/json');

        response.status.should.equal(422);
        response.should.be.json;
        response.body.should.have.property('errors').and.be.an('array');
        response.body.errors[0].status.should.equal(422);
        response.body.errors[0].detail.should.equal('Email, Password and Repeat password are required');
    });

    it('Registering a user without the actual data returns a 422 error - JSON version', async () => {
        const response = await requester
            .post(`/auth/sign-up`)
            .set('Content-Type', 'application/json');

        response.status.should.equal(422);
        response.should.be.json;
        response.body.should.have.property('errors').and.be.an('array');
        response.body.errors[0].status.should.equal(422);
        response.body.errors[0].detail.should.equal('Email, Password and Repeat password are required');
    });

    it('Registering a user with partial data returns a 422 error', async () => {
        const response = await requester
            .post(`/auth/sign-up`)
            .set('Content-Type', 'application/json')
            .send({
                email: 'someemail@gmail.com'
            });

        response.status.should.equal(422);
        response.should.be.json;
        response.body.should.have.property('errors').and.be.an('array');
        response.body.errors[0].status.should.equal(422);
        response.body.errors[0].detail.should.equal('Email, Password and Repeat password are required');
    });

    it('Registering a user with different passwords returns a 422 error', async () => {

        const response = await requester
            .post(`/auth/sign-up`)
            .set('Content-Type', 'application/json')
            .send({
                email: 'someemail@gmail.com',
                password: 'somepassword',
                repeatPassword: 'anotherpassword'
            });

        response.status.should.equal(422);
        response.should.be.json;
        response.body.should.have.property('errors').and.be.an('array');
        response.body.errors[0].status.should.equal(422);
        response.body.errors[0].detail.should.equal('Password and Repeat password not equal');

        const tempUser = await UserTempModel.findOne({ email: 'someemail@gmail.com' }).exec();
        should.not.exist(tempUser);
    });

    it('Registering a user with correct data and no app returns a 200', async () => {
        nock('https://api.sparkpost.com')
            .post('/api/v1/transmissions', (body) => {
                const expectedRequestBody = {
                    content: {
                        template_id: 'confirm-user'
                    },
                    recipients: [
                        {
                            address: {
                                email: 'someemail@gmail.com'
                            }
                        }
                    ],
                    substitution_data: {
                        fromEmail: 'noreply@resourcewatch.org',
                        fromName: 'RW API',
                        appName: 'RW API',
                        logo: 'https://resourcewatch.org/static/images/logo-embed.png'
                    }
                };

                body.should.have.property('substitution_data').and.be.an('object');
                body.substitution_data.should.have.property('urlConfirm').and.include(`${process.env.PUBLIC_URL}/auth/confirm/`);

                delete body.substitution_data.urlConfirm;

                body.should.deep.equal(expectedRequestBody);

                return isEqual(body, expectedRequestBody);
            })
            .reply(200);

        const missingUser = await UserTempModel.findOne({ email: 'someemail@gmail.com' }).exec();
        should.not.exist(missingUser);

        const response = await requester
            .post(`/auth/sign-up`)
            .set('Content-Type', 'application/json')
            .send({
                email: 'someemail@gmail.com',
                password: 'somepassword',
                repeatPassword: 'somepassword'
            });

        response.status.should.equal(200);
        response.should.be.json;
        // eslint-disable-next-line
        response.body.should.have.property('data').and.not.be.empty;

        const responseUser = response.body.data;
        responseUser.should.have.property('email').and.equal('someemail@gmail.com');
        responseUser.should.have.property('role').and.equal('USER');
        responseUser.should.have.property('extraUserData').and.be.an('object');
        // eslint-disable-next-line
        responseUser.extraUserData.should.have.property('apps').and.be.an('array').and.be.empty;

        const user = await UserTempModel.findOne({ email: 'someemail@gmail.com' }).exec();
        should.exist(user);

        user.should.have.property('email').and.equal('someemail@gmail.com');
        user.should.have.property('role').and.equal('USER');
        // eslint-disable-next-line
        user.should.have.property('confirmationToken').and.not.be.empty;
        user.should.have.property('extraUserData').and.be.an('object');
        // eslint-disable-next-line
        user.extraUserData.should.have.property('apps').and.be.an('array').and.be.empty;
    });

    it('Registering a user with an existing email address (temp user) returns a 422 error', async () => {
        const tempUser = await new UserTempModel({
            email: 'someemail@gmail.com',
            confirmationToken: 'myToken'
        }).save();

        should.exist(tempUser);

        const response = await requester
            .post(`/auth/sign-up`)
            .set('Content-Type', 'application/json')
            .send({
                email: 'someemail@gmail.com',
                password: 'somepassword',
                repeatPassword: 'somepassword'
            });

        response.status.should.equal(422);
        response.should.be.json;
        response.body.should.have.property('errors').and.be.an('array');
        response.body.errors[0].status.should.equal(422);
        response.body.errors[0].detail.should.equal('Email exists');
    });

    it('Confirming a user\'s account using the email token should be successful (user without app)', async () => {
        const tempUser = await new UserTempModel({
            email: 'someemail@gmail.com',
            confirmationToken: 'myToken',
            extraUserData: { apps: [] }
        }).save();

        const response = await requester
            .get(`/auth/confirm/${tempUser.confirmationToken}`)
            .set('Content-Type', 'application/json')
            .redirects(0);

        response.should.redirect;

        const missingTempUser = await UserTempModel.findOne({ email: 'someemail@gmail.com' }).exec();
        should.not.exist(missingTempUser);

        const confirmedUser = await UserModel.findOne({ email: 'someemail@gmail.com' }).exec();
        should.exist(confirmedUser);
        confirmedUser.should.have.property('email').and.equal('someemail@gmail.com');
        confirmedUser.should.have.property('role').and.equal('USER');
        confirmedUser.should.have.property('extraUserData').and.be.an('object');
        // eslint-disable-next-line
        confirmedUser.extraUserData.should.have.property('apps').and.be.an('array').and.be.empty;
    });

    it('Registering a user with an existing email address (confirmed user) returns a 422 error', async () => {
        const user = await new UserModel({
            email: 'someemail@gmail.com',
            confirmationToken: 'myToken',
            extraUserData: { apps: [] }
        }).save();

        should.exist(user);

        const response = await requester
            .post(`/auth/sign-up`)
            .set('Content-Type', 'application/json')
            .send({
                email: 'someemail@gmail.com',
                password: 'somepassword',
                repeatPassword: 'somepassword'
            });

        response.status.should.equal(422);
        response.should.be.json;
        response.body.should.have.property('errors').and.be.an('array');
        response.body.errors[0].status.should.equal(422);
        response.body.errors[0].detail.should.equal('Email exists');
    });

    it('Registering a user with correct data and app returns a 200', async () => {
        nock('https://api.sparkpost.com')
            .post('/api/v1/transmissions', (body) => {
                const expectedRequestBody = {
                    content: {
                        template_id: 'confirm-user'
                    },
                    recipients: [
                        {
                            address: {
                                email: 'someotheremail@gmail.com'
                            }
                        }
                    ],
                    substitution_data: {
                        fromEmail: 'noreply@resourcewatch.org',
                        fromName: 'RW API',
                        appName: 'RW API',
                        logo: 'https://resourcewatch.org/static/images/logo-embed.png'
                    }
                };

                body.should.have.property('substitution_data').and.be.an('object');
                body.substitution_data.should.have.property('urlConfirm').and.include(`${process.env.PUBLIC_URL}/auth/confirm/`);

                delete body.substitution_data.urlConfirm;

                body.should.deep.equal(expectedRequestBody);

                return isEqual(body, expectedRequestBody);
            })
            .reply(200);

        const missingUser = await UserTempModel.findOne({ email: 'someotheremail@gmail.com' }).exec();
        should.not.exist(missingUser);

        const response = await requester
            .post(`/auth/sign-up`)
            .set('Content-Type', 'application/json')
            .send({
                email: 'someotheremail@gmail.com',
                password: 'somepassword',
                repeatPassword: 'somepassword',
                apps: ['rw']
            });

        response.status.should.equal(200);
        response.should.be.json;
        // eslint-disable-next-line
        response.body.should.have.property('data').and.not.be.empty;

        const responseUser = response.body.data;
        responseUser.should.have.property('email').and.equal('someotheremail@gmail.com');
        responseUser.should.have.property('role').and.equal('USER');
        responseUser.should.have.property('extraUserData').and.be.an('object');
        // eslint-disable-next-line
        responseUser.extraUserData.should.have.property('apps').and.be.an('array').and.contain('rw');


        const user = await UserTempModel.findOne({ email: 'someotheremail@gmail.com' }).exec();
        should.exist(user);
        user.should.have.property('email').and.equal('someotheremail@gmail.com');
        user.should.have.property('role').and.equal('USER');
        // eslint-disable-next-line
        user.should.have.property('confirmationToken').and.not.be.empty;
        user.should.have.property('extraUserData').and.be.an('object');
        user.extraUserData.apps.should.be.an('array').and.contain('rw');
    });

    it('Registering a user with a custom role should return a 200 and ignore the role', async () => {
        nock('https://api.sparkpost.com')
            .post('/api/v1/transmissions', (body) => {
                const expectedRequestBody = {
                    content: {
                        template_id: 'confirm-user'
                    },
                    recipients: [
                        {
                            address: {
                                email: 'someotheremail@gmail.com'
                            }
                        }
                    ],
                    substitution_data: {
                        fromEmail: 'noreply@resourcewatch.org',
                        fromName: 'RW API',
                        appName: 'RW API',
                        logo: 'https://resourcewatch.org/static/images/logo-embed.png'
                    }
                };

                body.should.have.property('substitution_data').and.be.an('object');
                body.substitution_data.should.have.property('urlConfirm').and.include(`${process.env.PUBLIC_URL}/auth/confirm/`);

                delete body.substitution_data.urlConfirm;

                body.should.deep.equal(expectedRequestBody);

                return isEqual(body, expectedRequestBody);
            })
            .reply(200);

        const missingUser = await UserTempModel.findOne({ email: 'someotheremail@gmail.com' }).exec();
        should.not.exist(missingUser);

        const response = await requester
            .post(`/auth/sign-up`)
            .set('Content-Type', 'application/json')
            .send({
                email: 'someotheremail@gmail.com',
                password: 'somepassword',
                repeatPassword: 'somepassword',
                role: 'ADMIN',
                apps: ['rw']
            });

        response.status.should.equal(200);
        response.should.be.json;
        // eslint-disable-next-line
        response.body.should.have.property('data').and.not.be.empty;

        const responseUser = response.body.data;
        responseUser.should.have.property('email').and.equal('someotheremail@gmail.com');
        responseUser.should.have.property('role').and.equal('USER');
        responseUser.should.have.property('extraUserData').and.be.an('object');
        // eslint-disable-next-line
        responseUser.extraUserData.should.have.property('apps').and.be.an('array').and.contain('rw');


        const user = await UserTempModel.findOne({ email: 'someotheremail@gmail.com' }).exec();
        should.exist(user);
        user.should.have.property('email').and.equal('someotheremail@gmail.com');
        user.should.have.property('role').and.equal('USER');
        // eslint-disable-next-line
        user.should.have.property('confirmationToken').and.not.be.empty;
        user.should.have.property('extraUserData').and.be.an('object');
        user.extraUserData.apps.should.be.an('array').and.contain('rw');
    });

    it('Confirming a user\'s account using the email token should be successful (user with app)', async () => {
        const tempUser = await new UserTempModel({
            email: 'someotheremail@gmail.com',
            confirmationToken: 'myToken',
            extraUserData: { apps: ['rw'] }
        }).save();

        const response = await requester
            .get(`/auth/confirm/${tempUser.confirmationToken}`)
            .set('Content-Type', 'application/json')
            .redirects(0);

        response.should.redirect;

        const missingTempUser = await UserTempModel.findOne({ email: 'someotheremail@gmail.com' }).exec();
        should.not.exist(missingTempUser);

        const confirmedUser = await UserModel.findOne({ email: 'someotheremail@gmail.com' }).exec();
        should.exist(confirmedUser);
        confirmedUser.should.have.property('email').and.equal('someotheremail@gmail.com');
        confirmedUser.should.have.property('role').and.equal('USER');
        confirmedUser.should.have.property('extraUserData').and.be.an('object');
        confirmedUser.extraUserData.apps.should.be.an('array').and.contain('rw');
    });

    after(closeTestAgent);

    afterEach(async () => {
        await UserModel.deleteMany({}).exec();
        await UserTempModel.deleteMany({}).exec();

        if (!nock.isDone()) {
            throw new Error(`Not all nock interceptors were used: ${nock.pendingMocks()}`);
        }
    });
});
