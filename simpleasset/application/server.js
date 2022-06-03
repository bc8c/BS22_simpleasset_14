
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

app.post('/user', (request,response)=>{

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
                const obj = JSON.parse('{"ERR_MSG":"An identity for the admin user "admin" already exists in the wallet"}')
                response.status(400).json(obj);
            }

            // Enroll the admin user, and import the new identity into the wallet.
            const enrollment = await ca.enroll({ enrollmentID: id, enrollmentSecret: pw });
            const identity = X509WalletMixin.createIdentity('Org1MSP', enrollment.certificate, enrollment.key.toBytes());
            wallet.import('admin', identity);
            console.log('Successfully enrolled admin user "admin" and imported it into the wallet');
            const obj = JSON.parse('{"PAYLOAD":"Successfully enrolled admin user "admin" and imported it into the wallet"}')
            response.status(200).json(obj);
            
        } catch (error) {
            console.error(`Failed to enroll admin user "admin": ${error}`);
            // client( web browser )에게 오류를 전송
            const obj = JSON.parse('{"ERR_MSG":"Failed to enroll admin user "admin": ${error}"}')
            response.status(400).json(obj);
        }
    }
    else if(mode == 2){ // 사용자 인증서

    }
})






// 서버 시작
app.listen(PORT,HOST);
console.log(`Running on http://${HOST}:${PORT}`)