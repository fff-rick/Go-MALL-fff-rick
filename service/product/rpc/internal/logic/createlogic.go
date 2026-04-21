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
	UnknownErr = status.Error(500, "Unexcepted error")
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

func (l *CreateLogic) Create(in *product.CreateRequest) (*product.CreateResponse, error) {
	// todo: add your logic here and delete this line
	newProduct := &model.Product{
		Name:   in.Name,
		Desc:   in.Desc,
		Stock:  uint64(in.Stock),
		Amount: uint64(in.Amount),
		Status: uint64(in.Status),
	}
	res, err := l.svcCtx.ProductModel.Insert(context.Background(), newProduct)
	if err != nil {
		return nil, UnknownErr
	}
	Id, err := res.LastInsertId()
	if err != nil {
		return nil, UnknownErr
	}
	newProduct.Id = uint64(Id)
	return &product.CreateResponse{
		Id:     int64(newProduct.Id),
		Name:   newProduct.Name,
		Desc:   newProduct.Desc,
		Stock:  int64(newProduct.Stock),
		Amount: int64(newProduct.Amount),
		Status: int64(newProduct.Status),
	}, nil
}
