const chalk = require('chalk');
const changeCase = require('change-case');
const execa = require('execa');
const gitUserInfo = require('git-user-info');
const inquirer = require('inquirer');
const isValidNpmName = require('is-valid-npm-name');
const os = require('os');
const pkg = require('../package.json');
const {basename, resolve} = require('path');
const {sampleBackends} = require('@magento/pwa-buildpack/lib/cli/create-project');
module.exports = async () => {
	console.log(chalk.greenBright(`${pkg.name} v${pkg.version}`));
	console.log(chalk.white(`Creating a ${chalk.whiteBright('PWA Studio')} project`));
	const userAgent = process.env.npm_config_user_agent || '';
	const isYarn = userAgent.includes('yarn');
	const questions = [
		{
			message: 'Project root directory (will be created if it does not exist)'
			,name: 'directory'
			,validate: dir => !dir ? 'Please enter a directory path' : true
		},
		{
			default: ({directory}) => basename(directory)
			,message: 'Short name of the project to put in the package.json "name" field'
			,name: 'name'
			,validate: isValidNpmName
		},
		{
			default: () => {
				const userInfo = os.userInfo();
				let author = userInfo.username;
				const gitInfo = gitUserInfo({path: resolve(userInfo.homedir, '.gitconfig')});
				if (gitInfo) {
					author = gitInfo.name || author;
					if (gitInfo.email) {
						author += ` <${gitInfo.email}>`;
					}
				}
				return author;
			}
			,message: 'Name of the author to put in the package.json "author" field'
			,name: 'author'
		},
		{
			choices: sampleBackends.environments
				.map(({ name, description, url }) => ({
					name: description,
					value: url,
					short: name
				}))
				.concat([{
					name: 'Other (I will provide my own backing Magento instance)',
					value: false,
					short: 'Other'
				}])
			,message: 'Magento instance to use as a backend (will be added to `.env` file)'
			,name: 'backendUrl'
			,type: 'list'
		},
		{
			default: 'https://magento2.localhost'
			,message: 'URL of a Magento instance to use as a backend (will be added to `.env` file)'
			,name: 'customBackendUrl'
			,when: ({backendUrl}) => !backendUrl
		},
		{
			default: 'sandbox_8yrzsvtm_s2bg8fs563crhqzk'
			,message: 'Braintree API token to use to communicate with your Braintree instance (will be added to `.env` file)'
			,name: 'braintreeToken'
		},
		{
			choices: ['npm', 'yarn']
			,default: isYarn ? 'yarn' : 'npm'
			,message: 'NPM package management client to use'
			,name: 'npmClient'
			,type: 'list'
		},
		{
			default: true
			,message: ({npmClient}) => `Install package dependencies with ${npmClient} after creating project`
			,name: 'install'
			,type: 'confirm'
		}
	];
	let answers;
	try {answers = await inquirer.prompt(questions);}
	catch (e) {console.error('App creation cancelled.');}
	answers.backendUrl = answers.backendUrl || answers.customBackendUrl;
	const args = questions.reduce(
		(args, q) => {
			if (q.name === 'customBackendUrl' || q.name === 'directory') {
				return args;
			}
			const answer = answers[q.name];
			const option = changeCase.paramCase(q.name);
			if (q.type === 'confirm') {
				if (answer !== q.default) {
					return [...args, answer ? `--${option}` : `--no-${option}`];
				}
				return args;
			}
			return [...args, `--${option}`, `"${answer}"`];
		},
		['create-project', answers.directory, '--template', '"venia-concept"']
	);
	const argsString = args.join(' ');
	console.log('\nRunning command: \n\n' + chalk.whiteBright(`buildpack ${argsString}\n\n`));
	const buildpackBinLoc = resolve(require.resolve('@magento/pwa-buildpack'), '../../bin/buildpack');
	await execa.shell(`${buildpackBinLoc} ${argsString}`, {stdio: 'inherit'});
};