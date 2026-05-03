package logic

import (
	"context"
	"encoding/json"
	"net"
	"strings"
	"sync"
	"testing"

	"mall/service/order/api/internal/config"
	"mall/service/order/api/internal/svc"
	"mall/service/order/api/internal/types"
	orderpb "mall/service/order/rpc/pb/order"
	productpb "mall/service/product/rpc/pb/product"

	"github.com/dtm-labs/dtmgrpc/dtmgpb"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"
	emptypb "google.golang.org/protobuf/types/known/emptypb"
)

type fakeDtmServer struct {
	dtmgpb.UnimplementedDtmServer

	mu         sync.Mutex
	gid        string
	newGidHits int
	submitReq  *dtmgpb.DtmRequest
	submitErr  error
}

func (f *fakeDtmServer) NewGid(context.Context, *emptypb.Empty) (*dtmgpb.DtmGidReply, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.newGidHits++
	return &dtmgpb.DtmGidReply{Gid: f.gid}, nil
}

func (f *fakeDtmServer) Submit(_ context.Context, in *dtmgpb.DtmRequest) (*emptypb.Empty, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.submitReq = in
	if f.submitErr != nil {
		return nil, f.submitErr
	}

	return &emptypb.Empty{}, nil
}

func startFakeDtmServer(t *testing.T, server *fakeDtmServer) string {
	t.Helper()

	lis, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen fake dtm server: %v", err)
	}

	grpcServer := grpc.NewServer()
	dtmgpb.RegisterDtmServer(grpcServer, server)

	go func() {
		_ = grpcServer.Serve(lis)
	}()

	t.Cleanup(func() {
		grpcServer.Stop()
		_ = lis.Close()
	})

	return lis.Addr().String()
}

func decodeSteps(t *testing.T, raw string) []map[string]string {
	t.Helper()

	var steps []map[string]string
	if err := json.Unmarshal([]byte(raw), &steps); err != nil {
		t.Fatalf("unmarshal steps: %v", err)
	}

	return steps
}

func decodeOrderPayload(t *testing.T, payload []byte) *orderpb.CreateRequest {
	t.Helper()

	req := new(orderpb.CreateRequest)
	if err := proto.Unmarshal(payload, req); err != nil {
		t.Fatalf("unmarshal order payload: %v", err)
	}

	return req
}

func decodeProductPayload(t *testing.T, payload []byte) *productpb.DecrStockRequest {
	t.Helper()

	req := new(productpb.DecrStockRequest)
	if err := proto.Unmarshal(payload, req); err != nil {
		t.Fatalf("unmarshal product payload: %v", err)
	}

	return req
}

func TestCreate_SubmitsSagaWithConfiguredTargetsAndHeaders(t *testing.T) {
	fake := &fakeDtmServer{gid: "gid-test-1"}
	dtmAddr := startFakeDtmServer(t, fake)

	var c config.Config
	c.DtmServer = dtmAddr
	c.DtmRpc.App = "dtm"
	c.DtmRpc.Token = "dtm-branch-token"
	c.DtmTarget.Order = "order-svc:9002"
	c.DtmTarget.Product = "product-svc:9001"

	logic := NewCreateLogic(context.Background(), &svc.ServiceContext{Config: c})
	resp, err := logic.Create(&types.CreateRequest{
		Uid:    11,
		Pid:    22,
		Amount: 3,
		Status: 7,
	})
	if err != nil {
		t.Fatalf("Create returned error: %v", err)
	}
	if resp == nil {
		t.Fatal("Create returned nil response")
	}

	fake.mu.Lock()
	defer fake.mu.Unlock()

	if fake.newGidHits != 1 {
		t.Fatalf("expected NewGid to be called once, got %d", fake.newGidHits)
	}
	if fake.submitReq == nil {
		t.Fatal("expected Submit to receive a request")
	}
	if fake.submitReq.Gid != fake.gid {
		t.Fatalf("expected gid %q, got %q", fake.gid, fake.submitReq.Gid)
	}
	if fake.submitReq.TransType != "saga" {
		t.Fatalf("expected trans type saga, got %q", fake.submitReq.TransType)
	}
	if fake.submitReq.TransOptions == nil || !fake.submitReq.TransOptions.WaitResult {
		t.Fatal("expected WaitResult=true")
	}
	if got := fake.submitReq.TransOptions.BranchHeaders["app"]; got != "dtm" {
		t.Fatalf("expected branch header app=dtm, got %q", got)
	}
	if got := fake.submitReq.TransOptions.BranchHeaders["token"]; got != "dtm-branch-token" {
		t.Fatalf("expected branch header token=dtm-branch-token, got %q", got)
	}

	steps := decodeSteps(t, fake.submitReq.Steps)
	if len(steps) != 2 {
		t.Fatalf("expected 2 steps, got %d", len(steps))
	}

	if got := steps[0]["action"]; got != "order-svc:9002"+orderpb.Order_Create_FullMethodName {
		t.Fatalf("unexpected first action: %q", got)
	}
	if got := steps[0]["compensate"]; got != "order-svc:9002"+orderpb.Order_CreateRevert_FullMethodName {
		t.Fatalf("unexpected first compensate: %q", got)
	}
	if got := steps[1]["action"]; got != "product-svc:9001"+productpb.Product_DecrStock_FullMethodName {
		t.Fatalf("unexpected second action: %q", got)
	}
	if got := steps[1]["compensate"]; got != "product-svc:9001"+productpb.Product_DecrStockRevert_FullMethodName {
		t.Fatalf("unexpected second compensate: %q", got)
	}

	if len(fake.submitReq.BinPayloads) != 2 {
		t.Fatalf("expected 2 payloads, got %d", len(fake.submitReq.BinPayloads))
	}

	orderReq := decodeOrderPayload(t, fake.submitReq.BinPayloads[0])
	if orderReq.Uid != 11 || orderReq.Pid != 22 || orderReq.Amount != 3 || orderReq.Status != 0 {
		t.Fatalf("unexpected order payload: %+v", orderReq)
	}

	productReq := decodeProductPayload(t, fake.submitReq.BinPayloads[1])
	if productReq.Id != 22 || productReq.Num != 3 {
		t.Fatalf("unexpected product payload: %+v", productReq)
	}
}

func TestCreate_UsesDefaultTargetsWhenUnset(t *testing.T) {
	fake := &fakeDtmServer{gid: "gid-test-2"}
	dtmAddr := startFakeDtmServer(t, fake)

	var c config.Config
	c.DtmServer = dtmAddr

	logic := NewCreateLogic(context.Background(), &svc.ServiceContext{Config: c})
	_, err := logic.Create(&types.CreateRequest{
		Uid:    1,
		Pid:    2,
		Amount: 1,
	})
	if err != nil {
		t.Fatalf("Create returned error: %v", err)
	}

	fake.mu.Lock()
	defer fake.mu.Unlock()

	if fake.submitReq == nil {
		t.Fatal("expected Submit to receive a request")
	}

	steps := decodeSteps(t, fake.submitReq.Steps)
	if got := steps[0]["action"]; got != "127.0.0.1:9002"+orderpb.Order_Create_FullMethodName {
		t.Fatalf("unexpected default order target: %q", got)
	}
	if got := steps[1]["action"]; got != "127.0.0.1:9001"+productpb.Product_DecrStock_FullMethodName {
		t.Fatalf("unexpected default product target: %q", got)
	}
	if len(fake.submitReq.TransOptions.BranchHeaders) != 0 {
		t.Fatalf("expected no branch headers, got %+v", fake.submitReq.TransOptions.BranchHeaders)
	}
}

func TestCreate_ReturnsInternalErrorWhenSubmitFails(t *testing.T) {
	fake := &fakeDtmServer{
		gid:       "gid-test-3",
		submitErr: status.Error(codes.Unavailable, "submit failed"),
	}
	dtmAddr := startFakeDtmServer(t, fake)

	var c config.Config
	c.DtmServer = dtmAddr

	logic := NewCreateLogic(context.Background(), &svc.ServiceContext{Config: c})
	_, err := logic.Create(&types.CreateRequest{
		Uid:    1,
		Pid:    2,
		Amount: 1,
	})
	if err == nil {
		t.Fatal("expected error, got nil")
	}

	st, ok := status.FromError(err)
	if !ok {
		t.Fatalf("expected grpc status error, got %T", err)
	}
	if st.Code() != codes.Internal {
		t.Fatalf("expected code %s, got %s", codes.Internal, st.Code())
	}
	if !strings.Contains(st.Message(), "submit failed") {
		t.Fatalf("expected submit failure message, got %q", st.Message())
	}
}
