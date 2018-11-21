const fs = require('fs');

const Web3 = require('web3');
const loadContract = require('./contracts.js');


console.log("Connecting to local RPC...");
let web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8501"));
console.log("Connected");

const wallet = require('./wallet.js');
web3.eth.accounts.wallet = wallet;
console.log("Loaded accounts");

const address = wallet[0].address;

// Create dummy contract (will be filled later)
let dummyContract = new web3.eth.Contract([], '', {from: address});

const config = {
	TxGenerator: (contract, i) => contract.methods.set(i, "set "+i),
	TxCount: 1000,
	TxGas: 72000,
	ContractAddr: '0x7E8cdD73C12997AfF99b7607eFCf5e5D0acf660b',
}

const benchStarted = new Date();
loadContract('kvstore').then(({abi, bytecode}) => {
	dummyContract.options.jsonInterface = abi;
	bytecode = "0x" + bytecode
	let deployTx = dummyContract.deploy({data: bytecode});
	if (config.ContractAddr == '') {
		console.log('Deploying contract..');
		return deployTx.estimateGas()
			.then(gasEstimate => deployTx.send({from: address, gas: gasEstimate}), 
				(e) => console.log('estimate gas error', e))
	} else {
		console.log('Contract address provided; Using exising contract');
		let contract = dummyContract.clone();
		contract.options.address = config.ContractAddr;
		return contract;
	}
}).catch(e => console.log('deploy error', e))
.then(contract => {
	console.log(`Contract deployed at ${contract.options.address}`);
	return web3.eth.getTransactionCount(address)
		.then(txCount => [contract, txCount]) })
.then(([contract, txCount]) => {
	let log = [];
	let promises = [];
	let loggers = {};
	let TxRange = [];
	for (let i = 0; i < config.TxCount; i++) TxRange.push(i);
	const createLogger = field => TxRange.map((i)=>()=>{log[i][field]=new Date().valueOf();});
	loggers.submitted = createLogger('submitted');
	loggers.receipt = createLogger('receipt');
	loggers.processed = createLogger('processed');

	console.log("Sending Transactions...");
	const beforeSend = new Date();
	for(let i = 0; i < config.TxCount; i++) {
		log[i] = { sent: new Date().valueOf() };
		let promise = config.TxGenerator(contract, i).send({nonce: txCount + i, gas: config.TxGas})
			.on('transactionHash', loggers.submitted[i])
			.on('receipt', loggers.receipt[i])
			.then(loggers.processed[i])
			.catch(err => console.error(err));
		promises.push(promise);
	}
	const afterSend = new Date();
	console.log("Transaction sent");
	console.log(`Transaction submission took ${afterSend-beforeSend}ms`);
	Promise.all(promises)
		.then(() => {
			fs.writeFileSync("result/result_"+benchStarted.toISOString()+".json", JSON.stringify(log))
			console.log("Transaction completed");
		})
		.catch((e) => { console.error(e); console.log(log); });
});
