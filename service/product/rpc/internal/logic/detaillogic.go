package logic

import (
	"context"
	"fmt"

	"mall/service/product/model"
	"mall/service/product/rpc/internal/svc"
	"mall/service/product/rpc/pb/product"

	"github.com/zeromicro/go-zero/core/logx"
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

func (l *DetailLogic) Detail(in *product.DetailRequest) (*product.DetailResponse, error) {
	// todo: add your logic here and delete this line
	fmt.Println("调用detail...", "Id: ", in.Id)
	res, err := l.svcCtx.ProductModel.FindOne(context.Background(), uint64(in.Id))

	if err != nil {
		if err == model.ErrNotFound {
			return nil, NotExistsErr
		}
		return nil, UnknownErr
	}
	return &product.DetailResponse{
		Id:     int64(res.Id),
		Name:   res.Name,
		Desc:   res.Desc,
		Stock:  int64(res.Status),
		Amount: int64(res.Amount),
		Status: int64(res.Status),
	}, nil
}
