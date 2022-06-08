
// 필요한 모듈 생성!!

const express = require('express');
const app = express();

var bodyParser = require('body-parser')

const fs = require('fs')
const path = require('path');
const { request } = require('http');
const { response } = require('express');

// BN 접속을 위한 세팅
const FabricCAServices = require('fabric-ca-client');
const { FileSystemWallet, Gateway, X509WalletMixin } = require('fabric-network');

const ccpPath = path.resolve(__dirname, 'connection.json');
const ccpJSON = fs.readFileSync(ccpPath, 'utf8');
const ccp = JSON.parse(ccpJSON);

// 서버 속성
const PORT = 3000;
const HOST = '0.0.0.0';

// 서버 세팅
app.use(express.static(path.join(__dirname, 'views'))); // home/bstudent/dev/simpleasset/application/views
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended:false}));


 // HTML 페이지 라우팅
app.get('/', (request,response)=>{
     response.sendFile(__dirname+'/views/index.html');
})

app.get('/transfer', (request,response)=>{
    response.sendFile(__dirname+'/views/transfer.html');
})

// REST API 라우팅

app.post('/user', async(request,response)=>{

    const mode = request.body.mode
    console.log('/user-post- '+mode)

    // CA에 접속하여 인증서를 받아오는 기능
    // mode == 1 : 관리자 인증서 받아오기
    // mode == 2 : 사용자 인증서 받아오기

    if(mode == 1){ // 관리자 인증서

        const id = request.body.id;
        const pw = request.body.pw;
        console.log('/user-post- '+id+'-',+pw)

        try {
            
            // Create a new CA client for interacting with the CA.
            const caURL = ccp.certificateAuthorities['ca.example.com'].url;
            const ca = new FabricCAServices(caURL);

            // Create a new file system based wallet for managing identities.
            const walletPath = path.join(process.cwd(), 'wallet');
            const wallet = new FileSystemWallet(walletPath);
            console.log(`Wallet path: ${walletPath}`);

            // Check to see if we've already enrolled the admin user.
            const adminExists = await wallet.exists('admin');
            if (adminExists) {
                console.log('An identity for the admin user "admin" already exists in the wallet');
                // client( web browser )에게 오류를 전송
                const obj = JSON.parse('{"ERR_MSG":"An identity for the admin user admin already exists in the wallet"}')                
                
                response.status(400).json(obj);
                return
            }

            // Enroll the admin user, and import the new identity into the wallet.
            const enrollment = await ca.enroll({ enrollmentID: id, enrollmentSecret: pw });
            const identity = X509WalletMixin.createIdentity('Org1MSP', enrollment.certificate, enrollment.key.toBytes());
            wallet.import('admin', identity);
            console.log('Successfully enrolled admin user admin and imported it into the wallet');
            const obj = JSON.parse('{"PAYLOAD":"Successfully enrolled admin user admin and imported it into the wallet"}');
            response.status(200).json(obj);
            
        } catch (error) {
            console.error(`Failed to enroll admin user "admin": ${error}`);
            // client( web browser )에게 오류를 전송
            const obj = JSON.parse('{"ERR_MSG":"Failed to enroll admin user admin: ${error}"}')
            response.status(400).json(obj);
        }
    }
    else if(mode == 2){ // 사용자 인증서

        const id = request.body.id;
        const role = request.body.role;
        console.log('/user-post- '+id+'-',+role)

        try {

            // Create a new file system based wallet for managing identities.
            const walletPath = path.join(process.cwd(), 'wallet');
            const wallet = new FileSystemWallet(walletPath);
            console.log(`Wallet path: ${walletPath}`);
    
            // Check to see if we've already enrolled the user.
            const userExists = await wallet.exists(id);
            if (userExists) {
                console.log('An identity for the user "user1" already exists in the wallet');
                // client( web browser )에게 오류를 전송
                const obj = JSON.parse('{"ERR_MSG":"An identity for the user ${id} already exists in the wallet"}')                                       
                response.status(400).json(obj);
                return
            }
    
            // Check to see if we've already enrolled the admin user.
            const adminExists = await wallet.exists('admin');
            if (!adminExists) {
                console.log('An identity for the admin user "admin" does not exist in the wallet');
                console.log('Run the enrollAdmin.js application before retrying');
                // client( web browser )에게 오류를 전송
                const obj = JSON.parse('{"ERR_MSG":"An identity for the admin user admin does not exists in the wallet"}')
                response.status(400).json(obj);
                return
            }
    
            // Create a new gateway for connecting to our peer node.
            const gateway = new Gateway();
            await gateway.connect(ccp, { wallet, identity: 'admin', discovery: { enabled: false } });
    
            // Get the CA client object from the gateway for interacting with the CA.
            const ca = gateway.getClient().getCertificateAuthority();
            const adminIdentity = gateway.getCurrentIdentity();
    
            // Register the user, enroll the user, and import the new identity into the wallet.
            const secret = await ca.register({ affiliation: 'org1.department1', enrollmentID: id, role: role }, adminIdentity);
            const enrollment = await ca.enroll({ enrollmentID: id, enrollmentSecret: secret });
            const userIdentity = X509WalletMixin.createIdentity('Org1MSP', enrollment.certificate, enrollment.key.toBytes());
            wallet.import(id, userIdentity);
            console.log('Successfully registered and enrolled user and imported it into the wallet');
            const obj = JSON.parse('{"PAYLOAD":"Successfully enrolled admin user admin and imported it into the wallet"}')
            response.status(200).json(obj);
    
        } catch (error) {
            console.error(`Failed to register user ${id}: ${error}`);
            // client( web browser )에게 오류를 전송
            const obj = JSON.parse('{"ERR_MSG":"Failed to register user ${id}: ${error}"}')
            response.status(400).json(obj);
        }

    }
})

// 자산생성 post : '/asset'
app.post('/asset', async(request,response)=>{

    const id = request.body.id;
    const key = request.body.key;
    const value = request.body.value;
    console.log('/asset-post- '+id+'-',+key+'-',+value)

    // wallet에 있는 사용자 인증서 가져오기

    // Create a new file system based wallet for managing identities.
    const walletPath = path.join(process.cwd(), 'wallet');
    const wallet = new FileSystemWallet(walletPath);
    console.log(`Wallet path: ${walletPath}`);

    // Check to see if we've already enrolled the user.
    const userExists = await wallet.exists(id);
    if (!userExists) {
        console.log('An identity for the user ${id} does not exists in the wallet');
        // client( web browser )에게 오류를 전송
        const obj = JSON.parse('{"ERR_MSG":"An identity for the user ${id} does not exists in the wallet"}')                                       
        response.status(400).json(obj);
        return
    }
    
    // 블록체인 네트워크에 접속 ( peer1 에 접속 )

    // 1. 게이트웨이 접속
    const gateway = new Gateway();
    await gateway.connect(ccp, { wallet, identity: id, discovery: { enabled: false } });

    // 2. 채널( mychannel ) 접속
    const network = await gateway.getNetwork('mychannel');

    // 3. 체인코드 가져오기 ( simpleasset )
    const contract = network.getContract('simpleasset');


    // 4. 체인코드 호출하기 ( set ( key, value ) )
    await contract.submitTransaction('set', key, value);
    console.log('Transaction has been submitted');

    // 5. 게이트웨이 연결 해제
    await gateway.disconnect();


    // 수행 결과를 client에게 전달!

    const resultPath = path.join(process.cwd(), '/views/result.html')
    var resultHTML = fs.readFileSync(resultPath, 'utf8')
    resultHTML = resultHTML.replace("<div></div>", "<div><p>Transaction has been submitted</p></div>")
    response.status(200).send(resultHTML)

})

// 자산조회 get : '/asset'
app.get('/asset', async(request,response)=>{

    const id = request.query.id;
    const key = request.query.key;
    console.log('/asset-post- '+id+'-',+key)

    // wallet에 있는 사용자 인증서 가져오기

    // Create a new file system based wallet for managing identities.
    const walletPath = path.join(process.cwd(), 'wallet');
    const wallet = new FileSystemWallet(walletPath);
    console.log(`Wallet path: ${walletPath}`);

    // Check to see if we've already enrolled the user.
    const userExists = await wallet.exists(id);
    if (!userExists) {
        console.log('An identity for the user ${id} does not exists in the wallet');
        // client( web browser )에게 오류를 전송
        const obj = JSON.parse('{"ERR_MSG":"An identity for the user ${id} does not exists in the wallet"}')                                       
        response.status(400).json(obj);
        return
    }

    // 블록체인 네트워크에 접속 ( peer1 에 접속 )
    // 1. 게이트웨이 접속
    const gateway = new Gateway();
    await gateway.connect(ccp, { wallet, identity: id, discovery: { enabled: false } });

    // 2. 채널( mychannel ) 접속
    const network = await gateway.getNetwork('mychannel');

    // 3. 체인코드 가져오기 ( simpleasset )
    const contract = network.getContract('simpleasset');

    // 4. 체인코드 호출하기 ( get ( key ) )    
    const txresult = await contract.evaluateTransaction('get', key)
    console.log('Transaction has been submitted');

    // 5. 게이트웨이 연결 해제
    await gateway.disconnect();

    // 수행 결과를 client에게 전달!
    const obj = JSON.parse(txresult)
    response.status(200).json(obj)
})

// 히스토리조회 get : '/assets'
app.get('/assets', async(request,response)=>{

    // simpleasset 체인코드의 history 함수(기능)를 호출

    const id = request.query.id;
    const key = request.query.key;
    console.log('/asset-post- '+id+'-',+key)

    // wallet에 있는 사용자 인증서 가져오기

    // Create a new file system based wallet for managing identities.
    const walletPath = path.join(process.cwd(), 'wallet');
    const wallet = new FileSystemWallet(walletPath);
    console.log(`Wallet path: ${walletPath}`);

    // Check to see if we've already enrolled the user.
    const userExists = await wallet.exists(id);
    if (!userExists) {
        console.log('An identity for the user ${id} does not exists in the wallet');
        // client( web browser )에게 오류를 전송
        const obj = JSON.parse('{"ERR_MSG":"An identity for the user ${id} does not exists in the wallet"}')                                       
        response.status(400).json(obj);
        return
    }

    // 블록체인 네트워크에 접속 ( peer1 에 접속 )
    // 1. 게이트웨이 접속
    const gateway = new Gateway();
    await gateway.connect(ccp, { wallet, identity: id, discovery: { enabled: false } });

    // 2. 채널( mychannel ) 접속
    const network = await gateway.getNetwork('mychannel');

    // 3. 체인코드 가져오기 ( simpleasset )
    const contract = network.getContract('simpleasset');

    // 4. 체인코드 호출하기 ( get ( key ) )    
    const txresult = await contract.evaluateTransaction('history', key)
    console.log('Transaction has been submitted');

    // 5. 게이트웨이 연결 해제
    await gateway.disconnect();

    // 수행 결과를 client에게 전달!

    const resultPath = path.join(process.cwd(), '/views/result.html')
    var resultHTML = fs.readFileSync(resultPath, 'utf8')

    var tableHTML = "\n<table class=\"table table-bordered\">"
    const txs = JSON.parse(txresult)

    for(var i=0; i<txs.length; i++){
        tableHTML += "<tr><td>TxId</td>"
        tableHTML = tableHTML + "<td>"+ txs[i].TxId + "</td><tr>"
        tableHTML += "<tr><td>Timestamp</td>"
        tableHTML = tableHTML + "<td>"+ txs[i].Timestamp + "</td><tr>"
        tableHTML += "\n"
    }
    tableHTML += "</table>\n"

    resultHTML = resultHTML.replace("<div></div>",`<div><p>Transaction has been submitted</p><br> ${tableHTML}</div>`)

    response.status(200).send(resultHTML)
})




// 송금 post : '/tx'
app.post('/tx', async(request,response)=>{
    const id = request.body.id;
    const from = request.body.from;
    const to = request.body.to;
    const value = request.body.value;    
    console.log('/asset-post- '+id+'-',+from+'-',+to,'-',+value)

    // wallet에 있는 사용자 인증서 가져오기

    // Create a new file system based wallet for managing identities.
    const walletPath = path.join(process.cwd(), 'wallet');
    const wallet = new FileSystemWallet(walletPath);
    console.log(`Wallet path: ${walletPath}`);

    // Check to see if we've already enrolled the user.
    const userExists = await wallet.exists(id);
    if (!userExists) {
        console.log('An identity for the user ${id} does not exists in the wallet');
        // client( web browser )에게 오류를 전송
        const obj = JSON.parse('{"ERR_MSG":"An identity for the user ${id} does not exists in the wallet"}')                                       
        response.status(400).json(obj);
        return
    }
    
    // 블록체인 네트워크에 접속 ( peer1 에 접속 )

    // 1. 게이트웨이 접속
    const gateway = new Gateway();
    await gateway.connect(ccp, { wallet, identity: id, discovery: { enabled: false } });

    // 2. 채널( mychannel ) 접속
    const network = await gateway.getNetwork('mychannel');

    // 3. 체인코드 가져오기 ( simpleasset )
    const contract = network.getContract('simpleasset');


    // 4. 체인코드 호출하기 ( set ( key, value ) )
    await contract.submitTransaction('transfer', from, to, value);
    console.log('Transaction has been submitted');

    // 5. 게이트웨이 연결 해제
    await gateway.disconnect();


    // 수행 결과를 client에게 전달!

    const resultPath = path.join(process.cwd(), '/views/result.html')
    var resultHTML = fs.readFileSync(resultPath, 'utf8')
    resultHTML = resultHTML.replace("<div></div>", "<div><p>Transaction has been submitted</p></div>")
    response.status(200).send(resultHTML)
})








// 서버 시작
app.listen(PORT,HOST);
console.log(`Running on http://${HOST}:${PORT}`)