package logic

import (
	"context"

	"mall/service/pay/model"
	"mall/service/pay/rpc/internal/svc"
	"mall/service/pay/rpc/pb/pay"

	"github.com/zeromicro/go-zero/core/logx"
	"google.golang.org/grpc/status"
)

var (
	NotExistsErr = status.Error(100, "Pay does not exist")
)

type DetailLogic struct {
	ctx    context.Context
	svcCtx *svc.ServiceContext
	logx.Logger
}

func NewDetailLogic(ctx context.Context, svcCtx *svc.ServiceContext) *DetailLogic {
	return &DetailLogic{
		ctx:    ctx,
		svcCtx: svcCtx,
		Logger: logx.WithContext(ctx),
	}
}

func (l *DetailLogic) Detail(in *pay.DetailRequest) (*pay.DetailResponse, error) {
	// todo: add your logic here and delete this line

	res, err := l.svcCtx.PayModel.FindOne(context.Background(), uint64(in.Id))
	if err != nil {
		if err == model.ErrNotFound {
			return nil, NotExistsErr
		}
		return nil, UnknownErr
	}

	return &pay.DetailResponse{
		Id:     int64(res.Id),
		Uid:    int64(res.Uid),
		Oid:    int64(res.Oid),
		Amount: int64(res.Amount),
		Source: int64(res.Source),
		Status: int64(res.Status),
	}, nil
}
