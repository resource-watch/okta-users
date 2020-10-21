const logger = require('logger');
const okta = require('@okta/okta-sdk-nodejs');
const OktaAuth = require('@okta/okta-auth-js');

class OktaService {

    constructor() {
        logger.info('[OktaService] Initializing...');

        // Client for admin purposes
        this.oktaAdminClient = new okta.Client({
            // TODO: hardcoded stuff
            orgUrl: 'https://dev-859268.okta.com',
            // TODO: hardcoded stuff
            token: '00nG1_gmdnAhbynHkyvjl8lFS-lqQEhzdlmCSu2qp6',
        });

        // Client for authentication purposes
        this.oktaAuthClient = new OktaAuth({
            // TODO: hardcoded stuff
            issuer: 'https://dev-859268.okta.com'
        });
    }

    async getUserList() {
        logger.info('[OktaService] Getting user list...');

        const usersInResponse = [];

        // eslint-disable-next-line no-restricted-syntax
        for await (const user of this.oktaClient.listUsers()) {
            usersInResponse.push(user);
        }

        return usersInResponse;
    }

}

module.exports = OktaService;
