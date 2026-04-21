package logic

import (
	"context"

	"mall/common/cryptx"
	"mall/service/user/model"
	"mall/service/user/rpc/internal/svc"
	"mall/service/user/rpc/pb/user"

	"github.com/zeromicro/go-zero/core/logx"
	"google.golang.org/grpc/status"
)

var (
	UserExistsErr = status.Error(100, "User has existed")
	UserInsertErr = status.Error(500, "User inserts failed")
	UnkonwnErr    = status.Error(501, "Unexpected errors")
)

type RegisterLogic struct {
	ctx    context.Context
	svcCtx *svc.ServiceContext
	logx.Logger
}

func NewRegisterLogic(ctx context.Context, svcCtx *svc.ServiceContext) *RegisterLogic {
	return &RegisterLogic{
		ctx:    ctx,
		svcCtx: svcCtx,
		Logger: logx.WithContext(ctx),
	}
}

func (l *RegisterLogic) Register(in *user.RegisterRequest) (*user.RegisterResponse, error) {
	// todo: add your logic here and delete this line

	// 判断手机号是否注册
	_, err := l.svcCtx.UserModel.FindOneByMobile(context.Background(), in.Mobile)
	if err == nil {
		return nil, UserExistsErr
	}
	if err == model.ErrNotFound {
		newUser := model.User{
			Name:     in.Name,
			Gender:   uint64(in.Gender),
			Mobile:   in.Mobile,
			Password: cryptx.PasswordEncrypt(l.svcCtx.Config.Salt, in.Password),
		}
		res, err := l.svcCtx.UserModel.Insert(context.Background(), &newUser)
		if err != nil {
			return nil, UserInsertErr
		}

		Id, err := res.LastInsertId()
		newUser.Id = uint64(Id)
		if err != nil {
			return nil, UserInsertErr
		}
		return &user.RegisterResponse{
			Id:     int64(newUser.Id),
			Name:   newUser.Name,
			Gender: int64(newUser.Gender),
			Mobile: newUser.Mobile,
		}, nil
	}

	return nil, UnkonwnErr
}
