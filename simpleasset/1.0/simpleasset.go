// 패키지 정의
package main

// 1. 외부모듈 포함
import (
	"fmt"
	
	"github.com/hyperledger/fabric/core/chaincode/shim"
	"github.com/hyperledger/fabric/protos/peer"
)
// 2. 체인코드 클래스-구조체정의 SimpleAsset
type SimpleAsset struct {
}

// 3. Init 함수
func (t *SimpleAsset) Init(stub shim.ChaincodeStubInterface) peer.Response{
	args := stub.GetStringArgs()

	if len(args) != 2 {
		return shim.Error("Incorrect argumets. Explect a key and value")
	}
	err := stub.PutState(args[0], []byte(args[1]))
	if err != nil {
		return shim.Error(fmt.Sprintf("Failed to create asset: %s", args[0]))
		// return shim.Error("Failed to create asset: "+args[0])
	}

	return shim.Success([]byte("init success"))
}
// 4. Invoke 함수
func (t *SimpleAsset) Invoke(stub shim.ChaincodeStubInterface) peer.Response{
	fn, args := stub.GetFunctionAndParameters()
	
	if fn == "set" {
		return t.Set(stub, args)
	} else if fn == "get" {
		return t.Get(stub, args)
	}

	return shim.Error("Not supported function name")
}

// 5. set 함수
func (t *SimpleAsset) Set(stub shim.ChaincodeStubInterface, args []string) peer.Response{
	
	if len(args) != 2 {
		return shim.Error("Incorrect arguments. Expecting a key and value")
	}
	// 오류체크 중복 키 검사 -> 덮어쓰기로 해결

	err := stub.PutState(args[0], []byte(args[1]))
	if err != nil {
		return shim.Error("Failed to set asset: " + args[0])
	}

	return shim.Success([]byte("asset created: " + args[0]))
}

// 6. get 함수
func (t *SimpleAsset) Get(stub shim.ChaincodeStubInterface, args []string) peer.Response{

	if len(args) != 1 {
		return shim.Error("Incorrect arguments. Expecting a key")
	}

	value, err := stub.GetState(args[0])
	if err != nil {
		shim.Error("Filed to get asset: " + args[0] + " with error: " + err.Error())
	}
	if value == nil {
		shim.Error("Asset not found: " + args[0])
	}

	return shim.Success([]byte(value))
}

// 7. main 함수
func main() {
	if err := shim.Start(new(SimpleAsset)); err != nil {
		fmt.Printf("Error starting SimpleAsset chaincode : %s", err)
	}
}