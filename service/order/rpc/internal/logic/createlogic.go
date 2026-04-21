package logic

import (
	"context"

	"mall/service/order/rpc/internal/svc"
	"mall/service/order/rpc/pb/order"

	"github.com/zeromicro/go-zero/core/logx"
	"google.golang.org/grpc/status"
)

var (
	UnderStockErr  = status.Error(100, "Stock is not enough")
	InsertErr      = status.Error(100, "Insert order failed")
	UnknownErr     = status.Error(500, "Unexcepted error")
	UpdateStockErr = status.Error(100, "Update stock error")
)

type CreateLogic struct {
	ctx    context.Context
	svcCtx *svc.ServiceContext
	logx.Logger
}

func NewCreateLogic(ctx context.Context, svcCtx *svc.ServiceContext) *CreateLogic {
	return &CreateLogic{
		ctx:    ctx,
		svcCtx: svcCtx,
		Logger: logx.WithContext(ctx),
	}
}

func (l *CreateLogic) Create(in *order.CreateRequest) (*order.CreateResponse, error) {
	// todo: add your logic here and delete this line
	// 用户是否存在
	// 获取 RawDB

	return &order.CreateResponse{}, nil
}
