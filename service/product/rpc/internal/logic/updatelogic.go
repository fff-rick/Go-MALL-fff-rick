package logic

import (
	"context"

	"mall/service/product/model"
	"mall/service/product/rpc/internal/svc"
	"mall/service/product/rpc/pb/product"

	"github.com/zeromicro/go-zero/core/logx"
	"google.golang.org/grpc/status"
)

var (
	NotExistsErr = status.Error(100, "product does not exist")
	UpdateErr    = status.Error(100, "Update product failed")
)

type UpdateLogic struct {
	ctx    context.Context
	svcCtx *svc.ServiceContext
	logx.Logger
}

func NewUpdateLogic(ctx context.Context, svcCtx *svc.ServiceContext) *UpdateLogic {
	return &UpdateLogic{
		ctx:    ctx,
		svcCtx: svcCtx,
		Logger: logx.WithContext(ctx),
	}
}

func (l *UpdateLogic) Update(in *product.UpdateRequest) (*product.UpdateResponse, error) {
	// todo: add your logic here and delete this line
	res, err := l.svcCtx.ProductModel.FindOne(context.Background(), uint64(in.Id))
	if err != nil {
		if err == model.ErrNotFound {
			return nil, NotExistsErr
		}
		return nil, UnknownErr
	}
	if in.Name != "" {
		res.Name = in.Name
	}
	if in.Desc != "" {
		res.Desc = in.Desc
	}
	if in.Stock != 0 {
		res.Stock = uint64(in.Stock)
	}
	if in.Amount != 0 {
		res.Amount = uint64(in.Amount)
	}
	if in.Status != 0 {
		res.Status = uint64(in.Status)
	}

	err = l.svcCtx.ProductModel.Update(context.Background(), res)
	if err != nil {
		return nil, UpdateErr
	}

	return &product.UpdateResponse{
		Id:     int64(res.Id),
		Name:   res.Name,
		Desc:   res.Desc,
		Stock:  int64(res.Status),
		Amount: int64(res.Amount),
		Status: int64(res.Status),
	}, nil
}
