FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
EXPOSE 8080

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY ["src/QuanLyDatPhong_TBD.Domain/QuanLyDatPhong_TBD.Domain.csproj", "src/QuanLyDatPhong_TBD.Domain/"]
COPY ["src/QuanLyDatPhong_TBD.Application/QuanLyDatPhong_TBD.Application.csproj", "src/QuanLyDatPhong_TBD.Application/"]
COPY ["src/QuanLyDatPhong_TBD.Infrastructure/QuanLyDatPhong_TBD.Infrastructure.csproj", "src/QuanLyDatPhong_TBD.Infrastructure/"]
COPY ["src/QuanLyDatPhong_TBD.Api/QuanLyDatPhong_TBD.Api.csproj", "src/QuanLyDatPhong_TBD.Api/"]
RUN dotnet restore "src/QuanLyDatPhong_TBD.Api/QuanLyDatPhong_TBD.Api.csproj"
COPY . .
RUN dotnet publish "src/QuanLyDatPhong_TBD.Api/QuanLyDatPhong_TBD.Api.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM runtime AS final
WORKDIR /app
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "QuanLyDatPhong_TBD.Api.dll"]
