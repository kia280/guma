package ids

import (
	"fmt"
	"reflect"

	"github.com/google/uuid"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/reflect/protoreflect"

	"github.com/kia280/guma/internal/services/errs"
)

var uuidType = reflect.TypeFor[uuid.UUID]()

func Bind(msg proto.Message, dst any) error {
	v := reflect.ValueOf(dst)
	if v.Kind() != reflect.Pointer || v.Elem().Kind() != reflect.Struct {
		return fmt.Errorf("%w: ids.Bind needs a pointer to a struct, got %T", errs.ErrInternal, dst)
	}
	return bindMessage(msg.ProtoReflect(), v.Elem(), "")
}

func bindMessage(m protoreflect.Message, dst reflect.Value, prefix string) error {
	t := dst.Type()
	for i := 0; i < t.NumField(); i++ {
		sf := t.Field(i)
		if !sf.IsExported() {
			continue
		}
		name, ok := sf.Tag.Lookup("proto")
		if !ok || name == "" {
			return fmt.Errorf("%w: ids.Bind: %s.%s has no proto tag", errs.ErrInternal, t, sf.Name)
		}
		fd := m.Descriptor().Fields().ByName(protoreflect.Name(name))
		if fd == nil {
			return fmt.Errorf("%w: ids.Bind: %s has no field %q", errs.ErrInternal, m.Descriptor().FullName(), name)
		}
		if err := bindField(m, fd, dst.Field(i), prefix+name); err != nil {
			return err
		}
	}
	return nil
}

func bindField(m protoreflect.Message, fd protoreflect.FieldDescriptor, out reflect.Value, path string) error {
	t := out.Type()
	switch {
	case t == uuidType:
		raw, err := stringValue(m, fd, path)
		if err != nil {
			return err
		}
		id, err := Parse(path, raw)
		if err != nil {
			return err
		}
		out.Set(reflect.ValueOf(id))
	case t == reflect.PointerTo(uuidType):
		raw, err := stringValue(m, fd, path)
		if err != nil {
			return err
		}
		id, err := ParseOptional(path, raw)
		if err != nil {
			return err
		}
		if id != nil {
			out.Set(reflect.ValueOf(id))
		}
	case t.Kind() == reflect.Slice && t.Elem() == uuidType:
		if !fd.IsList() || fd.Kind() != protoreflect.StringKind {
			return mismatch(path, t)
		}
		list := m.Get(fd).List()
		parsed := make([]uuid.UUID, list.Len())
		for i := range parsed {
			id, err := Parse(path, list.Get(i).String())
			if err != nil {
				return err
			}
			parsed[i] = id
		}
		out.Set(reflect.ValueOf(parsed))
	case t.Kind() == reflect.Struct:
		if fd.IsList() || fd.Message() == nil {
			return mismatch(path, t)
		}
		return bindMessage(m.Get(fd).Message(), out, path+".")
	case t.Kind() == reflect.Pointer && t.Elem().Kind() == reflect.Struct:
		if fd.IsList() || fd.Message() == nil {
			return mismatch(path, t)
		}
		if !m.Has(fd) {
			return nil
		}
		nested := reflect.New(t.Elem())
		if err := bindMessage(m.Get(fd).Message(), nested.Elem(), path+"."); err != nil {
			return err
		}
		out.Set(nested)
	case t.Kind() == reflect.Slice && t.Elem().Kind() == reflect.Struct:
		if !fd.IsList() || fd.Message() == nil {
			return mismatch(path, t)
		}
		list := m.Get(fd).List()
		items := reflect.MakeSlice(t, list.Len(), list.Len())
		for i := 0; i < list.Len(); i++ {
			if err := bindMessage(list.Get(i).Message(), items.Index(i), fmt.Sprintf("%s[%d].", path, i)); err != nil {
				return err
			}
		}
		out.Set(items)
	default:
		return mismatch(path, t)
	}
	return nil
}

func stringValue(m protoreflect.Message, fd protoreflect.FieldDescriptor, path string) (string, error) {
	if fd.IsList() || fd.Kind() != protoreflect.StringKind {
		return "", fmt.Errorf("%w: ids.Bind: %s is not a string field", errs.ErrInternal, path)
	}
	return m.Get(fd).String(), nil
}

func mismatch(path string, t reflect.Type) error {
	return fmt.Errorf("%w: ids.Bind: cannot bind %s into %s", errs.ErrInternal, path, t)
}
