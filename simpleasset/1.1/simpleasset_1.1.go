// 패키지 정의
package main

// 1. 외부모듈 포함
import (
	"fmt"
	"encoding/json"	// JSON구조를 사용 (marshal, unmarshal)
	"strconv"	// 문자열과 기본형사이의 변환
	"time"		// 시간과 관련된 
	"bytes"		// 문자 버퍼를 사용하기 위한 라이블러리
	
	"github.com/hyperledger/fabric/core/chaincode/shim"
	"github.com/hyperledger/fabric/protos/peer"
)
// 2. 체인코드 클래스-구조체정의 SimpleAsset
type SimpleAsset struct {
}

type Asset struct{
	Key 	string `json:"key"`		// account address
	Value 	string `json:"value"`	// account balance
}

// 3. Init 함수
func (t *SimpleAsset) Init(stub shim.ChaincodeStubInterface) peer.Response{

	return shim.Success([]byte("init success"))
}
// 4. Invoke 함수
func (t *SimpleAsset) Invoke(stub shim.ChaincodeStubInterface) peer.Response{
	fn, args := stub.GetFunctionAndParameters()
	
	if fn == "set" {
		return t.Set(stub, args)
	} else if fn == "get" {
		return t.Get(stub, args)
	} else if fn == "del" {
		return t.Del(stub, args)
	} else if fn == "transfer" {
		return t.Transfer(stub, args)
	} else if fn == "history" {
		return t.History(stub, args)
	}

	return shim.Error("Not supported function name")
}

// 5. set 함수
func (t *SimpleAsset) Set(stub shim.ChaincodeStubInterface, args []string) peer.Response{
	
	if len(args) != 2 {
		return shim.Error("Incorrect arguments. Expecting a key and value")
	}
	// 오류체크 중복 키 검사 -> 덮어쓰기로 해결

	asset := Asset{Key: args[0], Value: args[1]}

	assetAsBytes, err := json.Marshal(asset)
	if err != nil {
		return shim.Error("Failed to marshal arguments: " +args[0]+" "+args[1])
	}

	err = stub.PutState(args[0], assetAsBytes)
	if err != nil {
		return shim.Error("Failed to set asset: " + args[0])
	}

	return shim.Success(assetAsBytes)
}

// 6. get 함수
func (t *SimpleAsset) Get(stub shim.ChaincodeStubInterface, args []string) peer.Response{

	if len(args) != 1 {
		return shim.Error("Incorrect arguments. Expecting a key")
	}

	value, err := stub.GetState(args[0])
	if err != nil {
		return shim.Error("Filed to get asset: " + args[0] + " with error: " + err.Error())
	}
	if value == nil {
		return shim.Error("Asset not found: " + args[0])
	}

	return shim.Success([]byte(value))
}

// 6.1 del 함수
func (t *SimpleAsset) Del(stub shim.ChaincodeStubInterface, args []string) peer.Response{

	if len(args) != 1 {
		return shim.Error("Incorrect arguments. Expecting a key")
	}

	value, err := stub.GetState(args[0])
	if err != nil {
		return shim.Error("Filed to get asset: " + args[0] + " with error: " + err.Error())
	}
	if value == nil {
		return shim.Error("Asset not found: " + args[0])
	}

	err = stub.DelState(args[0])

	return shim.Success([]byte(args[0]))
}

func (t *SimpleAsset) Transfer(stub shim.ChaincodeStubInterface, args []string) peer.Response{
	// 1. 전달인자 확인
	if len(args) != 3 {
		return shim.Error("Incorrect arguments. Expecting a from_key, to_key and amount")
	}
	// 2. 보내는이, 받는이 GetState -> unmarshal
	from_asset, err := stub.GetState(args[0])
	if err != nil {
		return shim.Error("Filed to get asset: " + args[0] + " with error: " + err.Error())
	}
	if from_asset == nil {
		return shim.Error("Asset not found: " + args[0])
	}
	to_asset, err := stub.GetState(args[1])
	if err != nil {
		return shim.Error("Filed to get asset: " + args[1] + " with error: " + err.Error())
	}
	if to_asset == nil {
		return shim.Error("Asset not found: " + args[1])
	}
	// 3. 잔액변환 및 검증, 전송수행
	from := Asset{}
	to := Asset{}
	json.Unmarshal(from_asset, &from)
	json.Unmarshal(to_asset, &to)

	from_amount, _ := strconv.Atoi(from.Value)
	to_amount, _ := strconv.Atoi(to.Value)
	amount, _ := strconv.Atoi(args[2])

	// 검증
	if( from_amount < amount ) {
		return shim.Error("Not enough asset value: "+args[0])
	}

	// 4. marshal
	from.Value = strconv.Itoa(from_amount - amount)
	to.Value = strconv.Itoa(to_amount + amount)

	from_asset, _ = json.Marshal(from)
	to_asset, _ = json.Marshal(to)
	
	// 5. PutState
	stub.PutState(args[0], from_asset)
	stub.PutState(args[1], to_asset)

	return shim.Success([]byte("transfer done!"))
}

func (t *SimpleAsset) History(stub shim.ChaincodeStubInterface, args []string) peer.Response{
	if len(args) < 1 {
		return shim.Error("Incorrect number of arguments. Expecting 1")
	}
	assetName := args[0]

	fmt.Printf("- start History: %s\n", assetName)

	resultsIterator, err := stub.GetHistoryForKey(assetName)
	if err != nil {
		return shim.Error(err.Error())
	}

	defer resultsIterator.Close() // 종료 수행 예약

	var buffer bytes.Buffer
	buffer.WriteString("[")

	bArrayMemberAlreadyWritten := false
	for resultsIterator.HasNext() {
		response, err := resultsIterator.Next()
		if err != nil{
			return shim.Error(err.Error())
		}

		if bArrayMemberAlreadyWritten == true {
			buffer.WriteString(",")
		}
		buffer.WriteString("{\"TxId\":")
		buffer.WriteString("\"")
		buffer.WriteString(response.TxId)
		buffer.WriteString("\"")

		buffer.WriteString(", \"Value\":")
		if response.IsDelete {
			buffer.WriteString("null")
		} else {
			buffer.WriteString(string(response.Value)) // JSON key, value world state
		}

		buffer.WriteString(", \"Timestamp\":")
		buffer.WriteString("\"")
		buffer.WriteString(time.Unix(response.Timestamp.Seconds, int64(response.Timestamp.Nanos)).String())
		buffer.WriteString("\"")

		buffer.WriteString(", \"IsDelete\":")
		buffer.WriteString("\"")
		buffer.WriteString(strconv.FormatBool(response.IsDelete))
		buffer.WriteString("\"")
		
		buffer.WriteString("}")
		bArrayMemberAlreadyWritten = true
	}
	buffer.WriteString("]")

	fmt.Printf("- History returning:\n%s\n", buffer.String())

	return shim.Success(buffer.Bytes())
}

// 7. main 함수
func main() {
	if err := shim.Start(new(SimpleAsset)); err != nil {
		fmt.Printf("Error starting SimpleAsset chaincode : %s", err)
	}
}