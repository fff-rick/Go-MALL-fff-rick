package logic

import (
	"context"

	"mall/service/order/rpc/pb/order"
	"mall/service/pay/model"
	"mall/service/pay/rpc/internal/svc"
	"mall/service/pay/rpc/pb/pay"
	"mall/service/user/rpc/pb/user"

	"github.com/zeromicro/go-zero/core/logx"
	"google.golang.org/grpc/status"
)

var (
	AlreadyPayErr = status.Error(100, "Order already paid")
	InsertErr     = status.Error(100, "Insert pay error")
	UnknownErr    = status.Error(500, "Unexcepted error")
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

func (l *CreateLogic) Create(in *pay.CreateRequest) (*pay.CreateResponse, error) {
	// todo: add your logic here and delete this line
	// 用户是否存在
	_, err := l.svcCtx.UserRpc.UserInfo(l.ctx, &user.UserInfoRequest{
		Id: in.Uid,
	})
	if err != nil {
		return nil, err
	}

	// 订单是否存在
	_, err = l.svcCtx.OrderRpc.Detail(l.ctx, &order.DetailRequest{
		Id: in.Oid,
	})
	if err != nil {
		return nil, err
	}

	// 是否已经支付
	_, err = l.svcCtx.PayModel.FindOne(context.Background(), uint64(in.Oid))
	if err == nil {
		return nil, AlreadyPayErr
	}

	newPay := &model.Pay{
		Uid:    uint64(in.Uid),
		Oid:    uint64(in.Oid),
		Amount: uint64(in.Amount),
		Source: uint64(in.Source),
		Status: 0,
	}

	res, err := l.svcCtx.PayModel.Insert(context.Background(), newPay)
	if err != nil {
		return nil, InsertErr
	}
	id, err := res.LastInsertId()
	if err != nil {
		return nil, UnknownErr
	}
	return &pay.CreateResponse{
		Id: id,
	}, nil
}
