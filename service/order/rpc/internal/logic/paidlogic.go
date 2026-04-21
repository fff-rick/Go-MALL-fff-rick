package logic

import (
	"context"

	"mall/service/order/model"
	"mall/service/order/rpc/internal/svc"
	"mall/service/order/rpc/pb/order"

	"github.com/zeromicro/go-zero/core/logx"
	"google.golang.org/grpc/status"
)

var (
	UpdateStatusErr = status.Error(100, "Update order status error")
)

type PaidLogic struct {
	ctx    context.Context
	svcCtx *svc.ServiceContext
	logx.Logger
}

func NewPaidLogic(ctx context.Context, svcCtx *svc.ServiceContext) *PaidLogic {
	return &PaidLogic{
		ctx:    ctx,
		svcCtx: svcCtx,
		Logger: logx.WithContext(ctx),
	}
}

func (l *PaidLogic) Paid(in *order.PaidRequest) (*order.PaidResponse, error) {
	// todo: add your logic here and delete this line

	res, err := l.svcCtx.OrderModel.FindOne(context.Background(), uint64(in.Id))
	if err != nil {
		if err == model.ErrNotFound {
			return nil, NotExistsErr
		}
		return nil, UnknownErr
	}

	res.Status = 1

	err = l.svcCtx.OrderModel.Update(context.Background(), res)
	if err != nil {
		return nil, UpdateStatusErr
	}

	return &order.PaidResponse{}, nil
}
