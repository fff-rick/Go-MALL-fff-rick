package logic

import (
	"context"

	"mall/service/order/model"
	"mall/service/order/rpc/internal/svc"
	"mall/service/order/rpc/pb/order"
	"mall/service/user/rpc/pb/user"

	"github.com/zeromicro/go-zero/core/logx"
)

type ListLogic struct {
	ctx    context.Context
	svcCtx *svc.ServiceContext
	logx.Logger
}

func NewListLogic(ctx context.Context, svcCtx *svc.ServiceContext) *ListLogic {
	return &ListLogic{
		ctx:    ctx,
		svcCtx: svcCtx,
		Logger: logx.WithContext(ctx),
	}
}

func (l *ListLogic) List(in *order.ListRequest) (*order.ListResponse, error) {
	// todo: add your logic here and delete this line
	// 用户是否存在
	_, err := l.svcCtx.UserRpc.UserInfo(l.ctx, &user.UserInfoRequest{
		Id: in.Uid,
	})
	if err != nil {
		return nil, err
	}

	//订单是否存在
	list, err := l.svcCtx.OrderModel.FindAllByUid(context.Background(), uint64(in.Uid))
	if err != nil {
		if err == model.ErrNotFound {
			return nil, NotExistsErr
		}
		return nil, UnknownErr
	}

	resp := make([]*order.DetailResponse, 0)
	for _, r := range list {
		res := &order.DetailResponse{
			Id:     int64(r.Id),
			Uid:    int64(r.Uid),
			Pid:    int64(r.Pid),
			Amount: int64(r.Amount),
			Status: int64(r.Status),
		}
		resp = append(resp, res)
	}
	return &order.ListResponse{
		Data: resp,
	}, nil
}
