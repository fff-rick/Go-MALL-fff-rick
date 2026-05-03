// Code scaffolded by goctl. Safe to edit.
// goctl 1.10.1

package logic

import (
	"context"

	"mall/service/order/api/internal/svc"
	"mall/service/order/api/internal/types"
	orderpb "mall/service/order/rpc/pb/order"
	productpb "mall/service/product/rpc/pb/product"

	"github.com/dtm-labs/dtmgrpc"
	"github.com/zeromicro/go-zero/core/logx"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type CreateLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewCreateLogic(ctx context.Context, svcCtx *svc.ServiceContext) *CreateLogic {
	return &CreateLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *CreateLogic) Create(req *types.CreateRequest) (resp *types.CreateResponse, err error) {
	dtmServer := l.svcCtx.Config.DtmServer
	if dtmServer == "" {
		dtmServer = "etcd://etcd:2379/dtmservice"
	}

	orderTarget := l.svcCtx.Config.DtmTarget.Order
	if orderTarget == "" {
		orderTarget = "127.0.0.1:9002"
	}

	productTarget := l.svcCtx.Config.DtmTarget.Product
	if productTarget == "" {
		productTarget = "127.0.0.1:9001"
	}

	saga := dtmgrpc.NewSagaGrpc(dtmServer, dtmgrpc.MustGenGid(dtmServer))
	saga.WaitResult = true
	if l.svcCtx.Config.DtmRpc.App != "" && l.svcCtx.Config.DtmRpc.Token != "" {
		saga.BranchHeaders = map[string]string{
			"app":   l.svcCtx.Config.DtmRpc.App,
			"token": l.svcCtx.Config.DtmRpc.Token,
		}
	}

	saga.Add(orderTarget+orderpb.Order_Create_FullMethodName, orderTarget+orderpb.Order_CreateRevert_FullMethodName, &orderpb.CreateRequest{
		Uid:    req.Uid,
		Pid:    req.Pid,
		Amount: req.Amount,
		Status: 0,
	}).Add(productTarget+productpb.Product_DecrStock_FullMethodName, productTarget+productpb.Product_DecrStockRevert_FullMethodName, &productpb.DecrStockRequest{
		Id:  req.Pid,
		Num: req.Amount,
	})

	if err := saga.Submit(); err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	return &types.CreateResponse{}, nil
}
