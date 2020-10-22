const config = require('config');
const nock = require('nock');

function mockOktaLoginSuccess() {
    nock(config.get('okta.serverUrl'))
        .post('/api/v1/authn')
        .reply(200, {
            expiresAt: '2020-10-21T16:34:29.000Z',
            status: 'SUCCESS',
            sessionToken: '20111hXj6p_WHd4DhERIB2RkmipHZKLBit-lp1unml70BBbJ-GpCijN',
            _embedded: {
                user: {
                    id: '00u6zzg5xieJ44diI5d5',
                    passwordChanged: '2020-10-06T10:15:57.000Z',
                    profile: {
                        login: 'henrique.pacheco@vizzuality.com',
                        firstName: 'Henrique',
                        lastName: 'Pacheco',
                        locale: 'en',
                        timeZone: 'America/Los_Angeles'
                    }
                }
            },
            _links: {
                cancel: {
                    href: `${config.get('okta.serverUrl')}/api/v1/authn/cancel`,
                    hints: {
                        allow: [
                            'POST'
                        ]
                    }
                }
            }
        });
}

function mockOktaLoginFailure() {
    nock(config.get('okta.serverUrl'))
        .post('/api/v1/authn')
        .reply(400, {
            errorCode: 'E0000001',
            errorSummary: 'Api validation failed: authRequest',
            errorLink: 'E0000001',
            errorId: 'oaeCDkH-WTdS325S5OtJtBEwQ',
            errorCauses: [
                { errorSummary: 'The \'username\' and \'password\' attributes are required in this context.' }
            ]
        });
}

module.exports = {
    mockOktaLoginSuccess,
    mockOktaLoginFailure,
};
